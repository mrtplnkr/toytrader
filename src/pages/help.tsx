import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
import { useTranslation } from "react-i18next";
import { Store } from "react-notifications-component";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "../firebase-config";
import { GoodAppContext } from "../hooks/context";
import { Offer } from "../types/offer";
import { Toy } from "../types/toy";
import { submitComplaint } from "../hooks/helper";

function notify(title: string, message: string, type: 'success' | 'danger') {
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
}

function HelpPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);

    const [offerId, setOfferId] = useState('');
    const [message, setMessage] = useState('');
    const [photoFile, setPhotoFile] = useState<string | undefined>();
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | undefined>();
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const toyTitle = (id: string) => toys.find((toy: Toy) => toy.id === id)?.title ?? t('help:aToy');

    const uploadPhoto = async (file: any) => {
        if (!file) return;
        setUploading(true);
        const fileName = v4();
        const fileRef = ref(storage, `projectFiles/${fileName}`);
        try {
            await uploadBytes(fileRef, file);
            const url = await getDownloadURL(fileRef);
            setPhotoFile(fileName);
            setPhotoPreviewUrl(url);
        } catch (err) {
            notify(t('common:toast.photoUploadFailedTitle'), t('common:toast.pictureUploadFailedBody'), "danger");
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async () => {
        if (!offerId) {
            notify(t('help:pickTradeTitle'), t('help:pickTradeBody'), "danger");
            return;
        }
        if (!message.trim()) {
            notify(t('help:descriptionRequiredTitle'), t('help:descriptionRequiredBody'), "danger");
            return;
        }
        const offer = offers.find((o: Offer) => o.id === offerId);
        if (!offer) return;
        const myUid = auth.currentUser?.uid;
        const reportedUid = offer.userInitiated === myUid ? offer.userReceived : offer.userInitiated;

        setSubmitting(true);
        try {
            await submitComplaint(offerId, reportedUid, message.trim(), photoFile);
            notify(t('help:submittedTitle'), t('help:submittedBody'), "success");
            navigate('/myOffers');
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="flex flex-col my-4">
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <h3>{t('help:heading')}</h3>

            <div className="card flex flex-col gap-4 max-w-[420px] mx-auto p-6">
                <label className="flex flex-col gap-1">
                    {t('help:whichTrade')}
                    <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
                        <option value="" disabled>{t('help:selectTrade')}</option>
                        {offers.map((o: Offer) => (
                            <option key={o.id} value={o.id}>
                                {t('help:tradeOption', {
                                    toyOffered: toyTitle(o.toyOffered),
                                    toyTargeted: toyTitle(o.toyTargeted),
                                    date: (o.offerCreated as Date).toDateString(),
                                })}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1">
                    {t('help:whatHappened')}
                    <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder={t('help:describePlaceholder')} />
                </label>

                <label className="flex flex-col gap-1">
                    {t('help:photoEvidence')}
                    <input type="file" accept="image/*"
                        onChange={(e) => uploadPhoto(e.target.files != null ? e.target.files[0] : '')} />
                </label>
                {uploading && <p className="text-[0.85em] m-0">{t('help:uploadingPhoto')}</p>}
                {photoPreviewUrl && <img src={photoPreviewUrl} alt="evidence" className="w-[8em] rounded-sm" />}

                <button className="btn-primary self-end" disabled={submitting || uploading} onClick={onSubmit}>
                    {submitting ? t('help:submitting') : t('help:submit')}
                </button>
            </div>
        </>
    );
}

export default HelpPage;
