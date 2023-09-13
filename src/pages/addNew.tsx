
import { useState } from "react";
import { db, auth, storage } from "../firebase-config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { addDoc, collection } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";

function AddNew() {
    const [title, setTitle] = useState<string>('');
    const [fileUploadName, setFileUpload] = useState('');
    const [url, setUrl] = useState<string | undefined>(undefined);
    const toyCollectionRef = collection(db, "toys");
    const navigate = useNavigate();

    const uploadFile = async (file: any) => {
        if (!file) return;
        const fileName = v4();
        setFileUpload(fileName);
        const filesFolderRef = ref(storage, `projectFiles/${fileName}`);
        
        try {
          await uploadBytes(filesFolderRef, file);
          const u = await getDownloadURL(ref(storage, `projectFiles/${fileName}`));
          setUrl(u);
        } catch (err) {
          console.error(err);
        }
    };
    
    const onSubmitToy = async () => {
        try {
            await addDoc(toyCollectionRef, {
                title,
                file: fileUploadName,
                userId: auth?.currentUser?.uid,
            });
            navigate('/myToys');
        } catch (err) {
            console.error(err);
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
            {url && <img style={{width: '5em', marginBottom: '1em'}} alt="newImg" src={url} />}
          </div>

          <div style={{display: 'flex', flexDirection: 'column'}}>
            <button type="submit" style={{alignSelf: 'flex-end'}}>Add</button>
          </div>
        </form>
      </>
    );
}

export default AddNew;
