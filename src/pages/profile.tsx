import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Store } from "react-notifications-component";
import { auth, storage } from "../firebase-config";

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
    const currentUser = auth.currentUser;

    const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL ?? '');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

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
            notify("Photo upload failed", "Please try selecting the picture again.", "danger");
        } finally {
            setUploading(false);
        }
    };

    const onSave = async () => {
        if (!currentUser) return;
        if (!displayName.trim()) {
            notify("Name required", "Please enter a display name.", "danger");
            return;
        }
        setSaving(true);
        try {
            await updateProfile(currentUser, { displayName: displayName.trim(), photoURL });
            notify("Profile updated !", "Your changes have been saved.", "success");
            navigate(-1);
        } catch (err) {
            notify("Unfortunately this action failed !", "Please try again later.", "danger");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div style={{display: 'flex', flexDirection: 'column', margin: '1em 0'}}>
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <h3>Your profile</h3>

            <div className="card" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em', maxWidth: '360px', margin: '0 auto', padding: '1.5em'}}>
                {photoURL &&
                    <img src={photoURL} alt={displayName || 'profile'}
                        style={{width: '5em', height: '5em', borderRadius: '50%', objectFit: 'cover'}} />}

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em', width: '100%'}}>
                    Display name
                    <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em', width: '100%'}}>
                    Change picture
                    <input type="file" onChange={(e) => uploadPhoto(e.target.files != null ? e.target.files[0] : '')} />
                </label>
                {uploading && <p style={{fontSize: '0.85em', margin: 0}}>Uploading picture...</p>}

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em', width: '100%'}}>
                    Email
                    <input type="text" value={currentUser?.email ?? ''} disabled />
                </label>

                <button className="btn-primary" disabled={saving || uploading} onClick={onSave} style={{alignSelf: 'flex-end'}}>
                    {saving ? 'saving...' : 'Save'}
                </button>
            </div>
        </>
    );
}

export default ProfilePage;
