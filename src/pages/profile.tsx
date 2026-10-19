import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Store } from "react-notifications-component";
import { auth, storage } from "../firebase-config";
import { getShippingProfile, notificationsSupported, ParcelMachine, requestNotificationPermission, saveShippingProfile } from "../hooks/helper";
import ParcelMachinePicker from "../components/parcelMachinePicker";

const notify = (title: string, message: string, type: 'success' | 'danger') => {
    Store.addNotification({
        title,
        message,
        type,
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: { duration: 5000, onScreen: true },
    });
};

function ProfilePage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const currentUser = auth.currentUser;

    const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL ?? '');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [shippingName, setShippingName] = useState('');
    const [shippingPhone, setShippingPhone] = useState('');
    // Kept as plain id/label/countryCode (not a full ParcelMachine object) -
    // ParcelMachinePicker only needs the id to show "Selected: ..." (it
    // looks the id up in its own freshly-fetched list), and a restored
    // saved profile has a label string already, not the original address.
    const [shippingMachineId, setShippingMachineId] = useState<string | undefined>();
    const [shippingMachineLabel, setShippingMachineLabel] = useState<string | undefined>();
    const [shippingCountryCode, setShippingCountryCode] = useState<string | undefined>();
    const [savingShipping, setSavingShipping] = useState(false);

    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | undefined>(
        notificationsSupported() ? Notification.permission : undefined
    );
    const [enablingNotifications, setEnablingNotifications] = useState(false);

    const onEnableNotifications = async () => {
        setEnablingNotifications(true);
        try {
            const result = await requestNotificationPermission();
            if (result === "granted") {
                setNotificationPermission("granted");
                notify(t('profile:notificationsEnabledTitle'), t('profile:notificationsEnabledBody'), "success");
            } else if (result === "denied") {
                setNotificationPermission("denied");
                notify(t('profile:notificationsDeniedTitle'), t('profile:notificationsDeniedBody'), "danger");
            }
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
        } finally {
            setEnablingNotifications(false);
        }
    };

    useEffect(() => {
        getShippingProfile().then((profile) => {
            if (!profile) return;
            setShippingName(profile.name);
            setShippingPhone(profile.phone);
            setShippingMachineId(profile.parcelMachineId);
            setShippingMachineLabel(profile.parcelMachineLabel);
            setShippingCountryCode(profile.countryCode);
        });
    }, []);

    const onPickMachine = (machine: ParcelMachine) => {
        setShippingMachineId(machine.id);
        setShippingMachineLabel(`${machine.name} — ${machine.address}`);
        setShippingCountryCode(machine.countryCode);
    };

    const onSaveShipping = async () => {
        if (!shippingName.trim() || !shippingPhone.trim() || !shippingMachineId || !shippingMachineLabel || !shippingCountryCode) {
            notify(t('profile:missingInfoTitle'), t('profile:missingInfoBody'), "danger");
            return;
        }
        setSavingShipping(true);
        try {
            await saveShippingProfile({
                name: shippingName.trim(),
                phone: shippingPhone.trim(),
                parcelMachineId: shippingMachineId,
                parcelMachineLabel: shippingMachineLabel,
                countryCode: shippingCountryCode,
            });
            notify(t('profile:shippingSavedTitle'), t('profile:shippingSavedBody'), "success");
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
        } finally {
            setSavingShipping(false);
        }
    };

    const uploadPhoto = async (file: any) => {
        if (!file) return;
        setUploading(true);
        const fileName = v4();
        const fileRef = ref(storage, `projectFiles/${fileName}`);
        try {
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            setPhotoURL(url);
        } catch (err) {
            notify(t('common:toast.photoUploadFailedTitle'), t('common:toast.pictureUploadFailedBody'), "danger");
        } finally {
            setUploading(false);
        }
    };

    const onSave = async () => {
        if (!currentUser) return;
        if (!displayName.trim()) {
            notify(t('profile:nameRequiredTitle'), t('profile:nameRequiredBody'), "danger");
            return;
        }
        setSaving(true);
        try {
            await updateProfile(currentUser, { displayName: displayName.trim(), photoURL });
            notify(t('profile:profileUpdatedTitle'), t('profile:profileUpdatedBody'), "success");
            navigate(-1);
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div className="flex flex-col my-4">
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <h3>{t('profile:heading')}</h3>

            <div className="card flex flex-col items-center gap-4 max-w-[360px] mx-auto p-6">
                {photoURL &&
                    <img src={photoURL} alt={displayName || 'profile'}
                        className="w-[5em] h-[5em] rounded-full object-cover" />}

                <label className="flex flex-col gap-1 w-full">
                    {t('profile:displayName')}
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>

                <label className="flex flex-col gap-1 w-full">
                    {t('profile:changePicture')}
                    <input type="file" onChange={(e) => uploadPhoto(e.target.files != null ? e.target.files[0] : '')} />
                </label>
                {uploading && <p className="text-[0.85em] m-0">{t('profile:uploadingPicture')}</p>}

                <label className="flex flex-col gap-1 w-full">
                    {t('profile:email')}
                    <input type="text" value={currentUser?.email ?? ''} disabled />
                </label>

                <button className="btn-primary self-end" disabled={saving || uploading} onClick={onSave}>
                    {saving ? t('profile:saving') : t('profile:save')}
                </button>
            </div>

            <h3>{t('profile:shippingHeading')}</h3>
            <p className="text-[0.9em] text-text-dim max-w-[360px] mx-auto mt-0 mb-4">
                {t('profile:shippingDescription')}
            </p>
            <div className="card flex flex-col items-center gap-4 max-w-[360px] mx-auto p-6">
                <label className="flex flex-col gap-1 w-full">
                    {t('profile:name')}
                    <input type="text" value={shippingName} onChange={(e) => setShippingName(e.target.value)} />
                </label>

                <label className="flex flex-col gap-1 w-full">
                    {t('profile:phone')}
                    <input type="tel" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} />
                </label>

                <ParcelMachinePicker value={shippingMachineId} onChange={onPickMachine} />

                <button className="btn-primary self-end" disabled={savingShipping} onClick={onSaveShipping}>
                    {savingShipping ? t('profile:saving') : t('profile:saveShippingInfo')}
                </button>
            </div>

            {notificationPermission !== undefined &&
                <>
                    <h3>{t('profile:notificationsHeading')}</h3>
                    <div className="card flex flex-col items-center gap-3 max-w-[360px] mx-auto p-6">
                        {notificationPermission === "granted" ?
                            <p className="m-0 text-text-dim">{t('profile:notificationsAlreadyEnabled')}</p>
                        : notificationPermission === "denied" ?
                            <p className="m-0 text-text-dim">{t('profile:notificationsBlocked')}</p>
                        :
                            <>
                                <p className="m-0 text-[0.9em] text-text-dim">{t('profile:notificationsDescription')}</p>
                                <button className="btn-primary" disabled={enablingNotifications} onClick={onEnableNotifications}>
                                    {enablingNotifications ? t('profile:saving') : t('profile:enableNotifications')}
                                </button>
                            </>}
                    </div>
                </>}
        </>
    );
}

export default ProfilePage;
