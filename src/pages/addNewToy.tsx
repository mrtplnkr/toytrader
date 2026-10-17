
import { useState } from "react";
import { storage } from "../firebase-config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
    const { t } = useTranslation();

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
          notifyError(t('addNewToy:imageUploadFailedTitle'), t('common:toast.pictureUploadFailedBody'));
        } finally {
          setUploading(false);
        }
    };

    const onSubmitToy = async () => {
        if (!url || !fileUploadName) {
            notifyError(t('addNewToy:pictureRequiredTitle'), t('addNewToy:pictureRequiredBody'));
            return;
        }
        try {
          await addNewToy(
            title,
            fileUploadName
          );
          navigate('/myToys');
        } catch (err) {
            notifyError(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'));
        }
    };

    return (
      <>
        <div className="flex flex-col my-4">
          <button id="backButton" onClick={() => navigate(-1)}>
            <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
          </button>
        </div>

        <h3>{t('addNewToy:heading')}</h3>

        <form id="newToy" className="flex flex-col" onSubmit={(e) => {
            onSubmitToy();
            e.preventDefault();
        }}>
          <div className="flex">
            <div className="text-left">
              <input id="title" type="text" className="my-2" onChange={(e) => setTitle(e.target.value)} />
              <input id="picture" type="file" alt="toy" className="my-2"
                  onChange={(e) => {
                      uploadFile(e.target.files != null ? e.target.files[0] : '')
                  }} />
            </div>
            {uploading && <p className="text-[0.85em]">{t('addNewToy:uploadingPicture')}</p>}
            {url && <img className="w-[5em] mb-4" alt="newImg" src={url} />}
          </div>

          <div className="flex flex-col">
            <button type="submit" disabled={uploading || !url} className="self-end">{t('addNewToy:add')}</button>
          </div>
        </form>
      </>
    );
}

export default AddNew;
