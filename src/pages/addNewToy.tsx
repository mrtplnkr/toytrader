
import { useState } from "react";
import { storage } from "../firebase-config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { addNewToy } from "../hooks/helper";
import { Store } from "react-notifications-component";

const notifyError = (title: string, message: string) => {
    Store.addNotification({
        title,
        message,
        type: "danger",
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: { duration: 5000, onScreen: true },
    });
};

function AddNew() {
    const [title, setTitle] = useState<string>('');
    const [fileUploadName, setFileUpload] = useState('');
    const [url, setUrl] = useState<string | undefined>(undefined);
    const [uploading, setUploading] = useState(false);
    const navigate = useNavigate();

    const uploadFile = async (file: any) => {
        if (!file) return;
        const fileName = v4();
        setUploading(true);
        setUrl(undefined);
        const filesFolderRef = ref(storage, `projectFiles/${fileName}`);

        try {
          await uploadBytes(filesFolderRef, file);
          const u = await getDownloadURL(ref(storage, `projectFiles/${fileName}`));
          setFileUpload(fileName);
          setUrl(u);
        } catch (err) {
          notifyError("Image upload failed", "Please try selecting the picture again.");
        } finally {
          setUploading(false);
        }
    };

    const onSubmitToy = async () => {
        if (!url || !fileUploadName) {
            notifyError("Picture required", "Please add a picture of your toy before submitting (wait for it to finish uploading).");
            return;
        }
        try {
          await addNewToy(
            title,
            fileUploadName
          );
          navigate('/myToys');
        } catch (err) {
            notifyError("Unfortunately this action failed !", "Please try again later.");
        }
    };

    return (
      <>
        <div style={{display: 'flex', flexDirection: 'column', margin: '1em 0'}}>
          <button id="backButton" onClick={() => navigate(-1)}>
            <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
          </button>
        </div>
        
        <h3>List your toy</h3>

        <form id="newToy" style={{display: 'flex', flexDirection: 'column'}} onSubmit={(e) => {
            onSubmitToy();
            e.preventDefault();
        }}>
          <div style={{display: 'flex'}}>
            <div style={{textAlign: 'left'}}>
              <input id="title" type="text" style={{margin: '0.5em 0'}} onChange={(e) => setTitle(e.target.value)} />
              <input id="picture" type="file" alt="toy" style={{margin: '0.5em 0'}}
                  onChange={(e) => {
                      uploadFile(e.target.files != null ? e.target.files[0] : '')
                  }} />
            </div>
            {uploading && <p style={{fontSize: '0.85em'}}>Uploading picture...</p>}
            {url && <img style={{width: '5em', marginBottom: '1em'}} alt="newImg" src={url} />}
          </div>

          <div style={{display: 'flex', flexDirection: 'column'}}>
            <button type="submit" disabled={uploading || !url} style={{alignSelf: 'flex-end'}}>Add</button>
          </div>
        </form>
      </>
    );
}

export default AddNew;
