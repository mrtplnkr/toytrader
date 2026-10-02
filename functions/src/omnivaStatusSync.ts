import {onSchedule} from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import {getApps, initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {getAuth} from "firebase-admin/auth";
import {getOmnivaClient, omnivaUsername, omnivaPassword, OmnivaShipmentStatus} from "./omniva";

if (getApps().length === 0) {
  initializeApp();
}

const REGION = "europe-west1";

const NON_TERMINAL_STATUSES: OmnivaShipmentStatus[] = [
  "REGISTERED",
  "IN_TRANSIT",
  "ARRIVED_AT_TERMINAL",
  "UNKNOWN",
];

const STATUS_LABELS: Record<OmnivaShipmentStatus, string> = {
  REGISTERED: "registered with Omniva",
  IN_TRANSIT: "in transit",
  ARRIVED_AT_TERMINAL: "arrived at the parcel machine",
  DELIVERED: "delivered",
  RETURNED: "returned",
  UNKNOWN: "unknown",
};

/**
 * Polls Omniva for shipments still in a non-terminal state and, on a status
 * change, writes it to the offer doc via the Admin SDK (client can never
 * write these fields - see firestore.rules) and queues an email
 * notification via the firestore-send-email extension's `mail` collection.
 * Terminal statuses (DELIVERED/RETURNED) naturally drop out of next run's
 * query, so no separate "stop polling" bookkeeping is needed.
 */
export const syncOmnivaShipmentStatuses = onSchedule(
  {region: REGION, schedule: "every 30 minutes", secrets: [omnivaUsername, omnivaPassword]},
  async () => {
    const db = getFirestore();
    const omniva = getOmnivaClient();

    for (const side of ["offer", "target"] as const) {
      const statusField = `${side}ShipmentStatus`;
      const barcodeField = `${side}ShipmentBarcode`;
      const updatedAtField = `${side}ShipmentStatusUpdatedAt`;

      const snap = await db.collection("offers").where(statusField, "in", NON_TERMINAL_STATUSES).get();

      for (const docSnap of snap.docs) {
        const offer = docSnap.data();
        const barcode = offer[barcodeField];
        if (!barcode) continue;

        let newStatus: OmnivaShipmentStatus;
        try {
          ({status: newStatus} = await omniva.getTrackingStatus(barcode));
        } catch (err) {
          logger.error("Omniva tracking lookup failed", docSnap.id, side, err);
          continue;
        }

        if (newStatus === offer[statusField]) continue;

        await docSnap.ref.update({
          [statusField]: newStatus,
          [updatedAtField]: FieldValue.serverTimestamp(),
        });

        const recipientUids = [offer.userInitiated, offer.userReceived].filter(Boolean) as string[];
        for (const uid of recipientUids) {
          const user = await getAuth().getUser(uid).catch((err) => {
            logger.error("Failed to look up user for shipment notification", uid, err);
            return undefined;
          });
          if (!user?.email) continue;

          await db.collection("mail").add({
            to: [user.email],
            message: {
              subject: `ToyTrader: shipment update - ${STATUS_LABELS[newStatus]}`,
              text: `Your parcel (barcode ${barcode}) is now ${STATUS_LABELS[newStatus]}.`,
            },
          });
        }
      }
    }
  }
);
