
import { useState } from "react";
import { storage } from "../firebase-config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace, faStar, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
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

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;

interface UploadedFile {
    fileName: string;
    url: string;
}

async function uploadToStorage(file: File): Promise<UploadedFile> {
    const fileName = v4();
    const fileRef = ref(storage, `projectFiles/${fileName}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return { fileName, url };
}

function AddNew() {
    const [title, setTitle] = useState<string>('');
    const [images, setImages] = useState<UploadedFile[]>([]);
    const [mainIndex, setMainIndex] = useState(0);
    const [video, setVideo] = useState<UploadedFile | undefined>(undefined);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    const uploadImage = async (file: File | undefined) => {
        if (!file) return;
        if (images.length >= MAX_IMAGES) {
            notifyError(t('addNewToy:maxImagesTitle'), t('addNewToy:maxImagesBody', { count: MAX_IMAGES }));
            return;
        }
        if (!file.type.startsWith('image/')) {
            notifyError(t('addNewToy:invalidImageTypeTitle'), t('addNewToy:invalidImageTypeBody'));
            return;
        }
        if (file.size > MAX_IMAGE_BYTES) {
            notifyError(t('addNewToy:imageTooLargeTitle'), t('addNewToy:imageTooLargeBody', { maxMb: MAX_IMAGE_BYTES / (1024 * 1024) }));
            return;
        }

        setUploadingImage(true);
        try {
            const uploaded = await uploadToStorage(file);
            setImages((prev) => [...prev, uploaded]);
        } catch (err) {
            notifyError(t('addNewToy:imageUploadFailedTitle'), t('common:toast.pictureUploadFailedBody'));
        } finally {
            setUploadingImage(false);
        }
    };

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, i) => i !== index));
        setMainIndex((prev) => {
            if (index < prev) return prev - 1;
            if (index === prev) return 0;
            return prev;
        });
    };

    const uploadVideo = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            notifyError(t('addNewToy:invalidVideoTypeTitle'), t('addNewToy:invalidVideoTypeBody'));
            return;
        }
        if (file.size > MAX_VIDEO_BYTES) {
            notifyError(t('addNewToy:videoTooLargeTitle'), t('addNewToy:videoTooLargeBody', { maxMb: MAX_VIDEO_BYTES / (1024 * 1024) }));
            return;
        }

        setUploadingVideo(true);
        try {
            const uploaded = await uploadToStorage(file);
            setVideo(uploaded);
        } catch (err) {
            notifyError(t('addNewToy:videoUploadFailedTitle'), t('common:toast.tryAgainLater'));
        } finally {
            setUploadingVideo(false);
        }
    };

    const onSubmitToy = async () => {
        if (images.length === 0) {
            notifyError(t('addNewToy:pictureRequiredTitle'), t('addNewToy:pictureRequiredBody'));
            return;
        }
        try {
          await addNewToy(
            title,
            images.map((i) => i.fileName),
            images[mainIndex].fileName,
            video?.fileName
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
          <div className="text-left">
            <input id="title" type="text" className="my-2" onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="flex flex-wrap gap-3 items-start my-2">
            {images.map((img, index) => (
                <div key={img.fileName} className="relative">
                    <img
                        alt={index === mainIndex ? "newImg" : `newImg${index + 1}`}
                        className={`w-[6em] h-[6em] object-cover rounded-sm cursor-pointer ${index === mainIndex ? 'ring-2 ring-primary' : ''}`}
                        src={img.url}
                        onClick={() => setMainIndex(index)}
                        title={t('addNewToy:setAsMain')}
                    />
                    {index === mainIndex &&
                        <span className="absolute top-1 left-1 bg-primary text-white rounded-full w-[1.4em] h-[1.4em] flex items-center justify-center text-[0.7em]"
                            title={t('addNewToy:mainPhoto')}>
                            <FontAwesomeIcon icon={faStar} />
                        </span>}
                    <button type="button" className="absolute top-1 right-1 bg-surface-raised rounded-full w-[1.4em] h-[1.4em] flex items-center justify-center"
                        onClick={() => removeImage(index)} title={t('addNewToy:removePhoto')}>
                        <FontAwesomeIcon icon={faXmark} />
                    </button>
                </div>
            ))}

            {images.length < MAX_IMAGES &&
                <div className="flex flex-col gap-1">
                    <input id="picture" type="file" accept="image/*" alt="toy" disabled={uploadingImage}
                        onChange={(e) => {
                            uploadImage(e.target.files?.[0]);
                            e.target.value = '';
                        }} />
                    {uploadingImage && <p className="text-[0.85em] m-0">{t('addNewToy:uploadingPicture')}</p>}
                </div>}
          </div>

          <div className="flex flex-wrap gap-3 items-start my-2">
            {video ?
                <div className="relative">
                    <video src={video.url} controls className="w-[12em] rounded-sm" />
                    <button type="button" className="absolute top-1 right-1 bg-surface-raised rounded-full w-[1.4em] h-[1.4em] flex items-center justify-center"
                        onClick={() => setVideo(undefined)} title={t('addNewToy:removeVideo')}>
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            :
                <div className="flex flex-col gap-1">
                    <label className="text-[0.85em] text-text-dim">{t('addNewToy:addVideo')}</label>
                    <input id="video" type="file" accept="video/*" disabled={uploadingVideo}
                        onChange={(e) => {
                            uploadVideo(e.target.files?.[0]);
                            e.target.value = '';
                        }} />
                    {uploadingVideo && <p className="text-[0.85em] m-0">{t('addNewToy:uploadingVideo')}</p>}
                </div>}
          </div>

          <div className="flex flex-col">
            <button type="submit" disabled={uploadingImage || uploadingVideo || images.length === 0} className="self-end">{t('addNewToy:add')}</button>
          </div>
        </form>
      </>
    );
}

export default AddNew;
