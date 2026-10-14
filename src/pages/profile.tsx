import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Store } from "react-notifications-component";
import { auth, storage } from "../firebase-config";
import { bootstrapAdmin, getShippingProfile, ParcelMachine, saveShippingProfile } from "../hooks/helper";
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
    const currentUser = auth.currentUser;

    const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
    const [photoURL, setPhotoURL] = useState(currentUser?.photoURL ?? '');
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [bootstrapping, setBootstrapping] = useState(false);

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
            notify("Missing info", "Name, phone, and a parcel machine are all required.", "danger");
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
            notify("Shipping info saved !", "You can now share this with trade partners from My Offers.", "success");
        } catch (err) {
            notify("Unfortunately this action failed !", "Please try again later.", "danger");
        } finally {
            setSavingShipping(false);
        }
    };

    // TEMPORARY - see functions/src/bootstrapAdmin.ts. Remove this button
    // (and that function, and the helper wrapper) once the real owner has
    // been granted the admin claim.
    const onBootstrapAdmin = async () => {
        setBootstrapping(true);
        try {
            await bootstrapAdmin();
            notify("You're now an admin", "Refresh the page to see the Admin menu item.", "success");
        } catch (err) {
            notify("Not eligible", "This account isn't on the admin allowlist.", "danger");
        } finally {
            setBootstrapping(false);
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

                <button disabled={bootstrapping} onClick={onBootstrapAdmin} style={{alignSelf: 'flex-end', fontSize: '0.8em'}}>
                    {bootstrapping ? 'checking...' : 'Become admin (one-time)'}
                </button>
            </div>

            <h3>Shipping info</h3>
            <p style={{fontSize: '0.9em', color: 'var(--color-text-dim)', maxWidth: '360px', margin: '0 auto 1em'}}>
                Shared with a trade partner once you're ready to ship, so they know who/where to
                send their toy to - this app ships via Omniva parcel machines, not door-to-door,
                so no home address is needed, just your name, phone, and preferred parcel machine.
            </p>
            <div className="card" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1em', maxWidth: '360px', margin: '0 auto', padding: '1.5em'}}>
                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em', width: '100%'}}>
                    Name
                    <input type="text" value={shippingName} onChange={(e) => setShippingName(e.target.value)} />
                </label>

                <label style={{display: 'flex', flexDirection: 'column', gap: '0.25em', width: '100%'}}>
                    Phone
                    <input type="tel" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} />
                </label>

                <ParcelMachinePicker value={shippingMachineId} onChange={onPickMachine} />

                <button className="btn-primary" disabled={savingShipping} onClick={onSaveShipping} style={{alignSelf: 'flex-end'}}>
                    {savingShipping ? 'saving...' : 'Save shipping info'}
                </button>
            </div>
        </>
    );
}

export default ProfilePage;
