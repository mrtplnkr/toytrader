import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContextSelector } from "use-context-selector";
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
    const offers = useContextSelector(GoodAppContext, (state: any) => state.offers);
    const toys = useContextSelector(GoodAppContext, (state: any) => state.toys);

    const [offerId, setOfferId] = useState('');
    const [message, setMessage] = useState('');
    const [photoFile, setPhotoFile] = useState<string | undefined>();
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | undefined>();
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const toyTitle = (id: string) => toys.find((t: Toy) => t.id === id)?.title ?? 'a toy';

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
            notify("Photo upload failed", "Please try selecting the picture again.", "danger");
        } finally {
            setUploading(false);
        }
    };

    const onSubmit = async () => {
        if (!offerId) {
            notify("Pick a trade", "Choose which trade this complaint is about.", "danger");
            return;
        }
        if (!message.trim()) {
            notify("Description required", "Please describe what went wrong.", "danger");
            return;
        }
        const offer = offers.find((o: Offer) => o.id === offerId);
        if (!offer) return;
        const myUid = auth.currentUser?.uid;
        const reportedUid = offer.userInitiated === myUid ? offer.userReceived : offer.userInitiated;

        setSubmitting(true);
        try {
            await submitComplaint(offerId, reportedUid, message.trim(), photoFile);
            notify("Complaint submitted", "We'll take a look - thanks for letting us know.", "success");
            navigate('/myOffers');
        } catch (err) {
            notify("Unfortunately this action failed !", "Please try again later.", "danger");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div style={{display: 'flex', flexDirection: 'column', margin: '1em 0'}}>
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <h3>Report a problem with a trade</h3>

            <div className="card" style={{display: 'flex', flexDirection: 'column', gap: '1em', maxWidth: '420px', margin: '0 auto', padding: '1.5em'}}>
                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em'}}>
                    Which trade?
                    <select value={offerId} onChange={(e) => setOfferId(e.target.value)}>
                        <option value="" disabled>Select a trade...</option>
                        {offers.map((o: Offer) => (
                            <option key={o.id} value={o.id}>
                                {toyTitle(o.toyOffered)} for {toyTitle(o.toyTargeted)} ({(o.offerCreated as Date).toDateString()})
                            </option>
                        ))}
                    </select>
                </label>

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em'}}>
                    What happened?
                    <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe the problem with this trade..." />
                </label>

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em'}}>
                    Photo evidence (optional)
                    <input type="file" accept="image/*"
                        onChange={(e) => uploadPhoto(e.target.files != null ? e.target.files[0] : '')} />
                </label>
                {uploading && <p style={{fontSize: '0.85em', margin: 0}}>Uploading photo...</p>}
                {photoPreviewUrl && <img src={photoPreviewUrl} alt="evidence" style={{width: '8em', borderRadius: 'var(--radius-sm)'}} />}

                <button className="btn-primary" disabled={submitting || uploading} onClick={onSubmit} style={{alignSelf: 'flex-end'}}>
                    {submitting ? 'submitting...' : 'Submit complaint'}
                </button>
            </div>
        </>
    );
}

export default HelpPage;
