
import { useEffect, useRef, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, storage } from "../firebase-config";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { v4 } from 'uuid';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace, faCameraRetro, faStar, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
import { addNewToy, updateToy } from "../hooks/helper";
import { Store } from "react-notifications-component";
import ToyListedCelebration from "../components/toyListedCelebration";

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
const CELEBRATION_DURATION_MS = 2500;
const MAX_TOY_AGE = 18;

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
    // Present (editing an existing toy) or absent (listing a brand new one) -
    // see the /editToy/:toyId route in App.tsx. Reusing this one form for
    // both instead of a parallel page since they're ~the same form (title,
    // up to 3 photos with a main-photo picker, one optional video, the same
    // validation) - only the data source and the submit call differ.
    const { toyId } = useParams<{ toyId?: string }>();
    const isEditMode = !!toyId;

    const [title, setTitle] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    // Approximate suitable age range in years - required, validated before
    // submit (see onSubmitToy). Kept as strings while editing so an empty
    // field reads as "not filled in yet" rather than coercing to 0.
    const [ageMin, setAgeMin] = useState<string>('');
    const [ageMax, setAgeMax] = useState<string>('');
    // Only required for a brand-new listing, not an edit - the toy's
    // physical completeness isn't something an edit (title/photo tweaks)
    // would change.
    const [confirmedComplete, setConfirmedComplete] = useState(false);
    const [images, setImages] = useState<UploadedFile[]>([]);
    const [mainIndex, setMainIndex] = useState(0);
    const [video, setVideo] = useState<UploadedFile | undefined>(undefined);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [loadingExisting, setLoadingExisting] = useState(isEditMode);
    const [notOwner, setNotOwner] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();

    // Raw filenames this toy had when the edit form loaded - lets
    // removeImage/removeVideo below tell "removed a file that's actually
    // saved on this toy" (needs cleaning up in Storage once saved) apart
    // from "removed something uploaded earlier this same session" (never
    // got referenced by any Firestore doc in the first place).
    const originalFileNamesRef = useRef<Set<string>>(new Set());
    const [removedFileNames, setRemovedFileNames] = useState<string[]>([]);

    useEffect(() => {
        if (!toyId) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, "toys", toyId));
                const data = snap.data();
                if (!data || data.userId !== auth.currentUser?.uid) {
                    setNotOwner(true);
                    return;
                }

                const rawImages: string[] = data.images && data.images.length > 0 ? data.images : [data.file];
                originalFileNamesRef.current = new Set(data.video ? [...rawImages, data.video] : rawImages);

                const resolvedImages = await Promise.all(rawImages.map(async (name: string) => ({
                    fileName: name,
                    url: await getDownloadURL(ref(storage, `projectFiles/${name}`)),
                })));
                setTitle(data.title);
                setDescription(data.description ?? '');
                setAgeMin(data.ageMin !== undefined ? String(data.ageMin) : '');
                setAgeMax(data.ageMax !== undefined ? String(data.ageMax) : '');
                setImages(resolvedImages);
                setMainIndex(Math.max(0, rawImages.indexOf(data.file)));
                if (data.video) {
                    setVideo({ fileName: data.video, url: await getDownloadURL(ref(storage, `projectFiles/${data.video}`)) });
                }
            } catch (err) {
                notifyError(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'));
            } finally {
                setLoadingExisting(false);
            }
        })();
    // Only ever runs once, for whichever toyId this page mounted with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toyId]);

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
        const removed = images[index];
        if (originalFileNamesRef.current.has(removed.fileName)) {
            setRemovedFileNames((prev) => [...prev, removed.fileName]);
        }
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

    const removeVideo = () => {
        if (video && originalFileNamesRef.current.has(video.fileName)) {
            setRemovedFileNames((prev) => [...prev, video.fileName]);
        }
        setVideo(undefined);
    };

    // Picks up a file shared into the installed PWA via the OS "Share" sheet
    // (manifest.json's share_target). The service worker can't hand the file
    // to a client directly since none exists yet when the POST arrives - it
    // stashes it in the Cache API instead and redirects here with ?shared=1,
    // see src/service-worker.ts.
    useEffect(() => {
        if (toyId) return;
        if (new URLSearchParams(window.location.search).get('shared') !== '1') return;
        (async () => {
            try {
                const cache = await caches.open('share-target-v1');
                const res = await cache.match('/__shared-file');
                if (res) {
                    const blob = await res.blob();
                    const contentType = res.headers.get('Content-Type') || blob.type;
                    const rawName = res.headers.get('X-File-Name');
                    const name = rawName ? decodeURIComponent(rawName) : `shared.${contentType.split('/')[1] || 'bin'}`;
                    const file = new File([blob], name, { type: contentType });
                    if (contentType.startsWith('video/')) {
                        await uploadVideo(file);
                    } else if (contentType.startsWith('image/')) {
                        await uploadImage(file);
                    }
                    await cache.delete('/__shared-file');
                }
            } catch {
                // Best effort - worst case this behaves like a normal manual
                // visit to /addNew with nothing pre-attached.
            } finally {
                navigate('/addNew', { replace: true });
            }
        })();
    // Only ever runs once on mount to pick up a pending handoff, if any.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSubmitToy = async () => {
        if (images.length === 0) {
            notifyError(t('addNewToy:pictureRequiredTitle'), t('addNewToy:pictureRequiredBody'));
            return;
        }
        if (!isEditMode && !confirmedComplete) {
            notifyError(t('addNewToy:confirmCompleteRequiredTitle'), t('addNewToy:confirmCompleteRequiredBody'));
            return;
        }
        const ageMinNum = Number(ageMin);
        const ageMaxNum = Number(ageMax);
        if (ageMin.trim() === '' || ageMax.trim() === '' || Number.isNaN(ageMinNum) || Number.isNaN(ageMaxNum)) {
            notifyError(t('addNewToy:ageRequiredTitle'), t('addNewToy:ageRequiredBody'));
            return;
        }
        if (ageMinNum < 0 || ageMaxNum < 0 || ageMinNum > MAX_TOY_AGE || ageMaxNum > MAX_TOY_AGE) {
            notifyError(t('addNewToy:ageInvalidTitle'), t('addNewToy:ageInvalidBody', { max: MAX_TOY_AGE }));
            return;
        }
        if (ageMinNum > ageMaxNum) {
            notifyError(t('addNewToy:ageRangeInvalidTitle'), t('addNewToy:ageRangeInvalidBody'));
            return;
        }
        try {
          if (isEditMode && toyId) {
              await updateToy(
                  toyId,
                  title,
                  images.map((i) => i.fileName),
                  images[mainIndex].fileName,
                  video?.fileName,
                  removedFileNames,
                  ageMinNum,
                  ageMaxNum,
                  description.trim() || undefined
              );
              navigate('/myToys');
          } else {
              await addNewToy(
                  title,
                  images.map((i) => i.fileName),
                  images[mainIndex].fileName,
                  ageMinNum,
                  ageMaxNum,
                  video?.fileName,
                  description.trim() || undefined
              );
              // Only for a genuinely new listing, not an edit - a brief
              // confetti + thank-you moment before landing on /myToys,
              // instead of an instant silent redirect.
              setShowCelebration(true);
              setTimeout(() => navigate('/myToys'), CELEBRATION_DURATION_MS);
          }
        } catch (err) {
            notifyError(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'));
        }
    };

    if (notOwner) {
        return <Navigate to="/myToys" replace />;
    }

    if (loadingExisting) {
        return <p>{t('addNewToy:loadingToy')}</p>;
    }

    return (
      <>
        {showCelebration && <ToyListedCelebration />}

        <div className="flex flex-col my-4">
          <button id="backButton" onClick={() => navigate(-1)}>
            <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
          </button>
        </div>

        <h3>{t(isEditMode ? 'addNewToy:editHeading' : 'addNewToy:heading')}</h3>

        <form id="newToy" className="flex flex-col" onSubmit={(e) => {
            onSubmitToy();
            e.preventDefault();
        }}>
          <div className="text-left">
            <input id="title" type="text" className="my-2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <label className="flex flex-col gap-1 text-left my-2">
            <span className="text-[0.85em] text-text-dim">{t('addNewToy:descriptionLabel')}</span>
            <textarea id="description" rows={3}
              placeholder={t('addNewToy:descriptionPlaceholder')}
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <div className="flex flex-col gap-1 text-left my-2">
            <span className="text-[0.85em] text-text-dim">{t('addNewToy:ageRangeLabel')}</span>
            <div className="flex items-center gap-2">
              <input id="ageMin" type="number" min={0} max={MAX_TOY_AGE} className="w-[5em]"
                placeholder={t('addNewToy:ageFromPlaceholder')}
                value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
              <span className="text-text-dim">{t('addNewToy:ageRangeTo')}</span>
              <input id="ageMax" type="number" min={0} max={MAX_TOY_AGE} className="w-[5em]"
                placeholder={t('addNewToy:ageToPlaceholder')}
                value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
              <span className="text-text-dim text-[0.85em]">{t('addNewToy:ageRangeYears')}</span>
            </div>
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
                    <label htmlFor="picture" className="text-[0.85em] text-text-dim flex items-center gap-1">
                        <FontAwesomeIcon icon={faCameraRetro} />
                        {t('addNewToy:takeClearPhoto')}
                    </label>
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
                        onClick={removeVideo} title={t('addNewToy:removeVideo')}>
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

          {!isEditMode &&
              <label className="flex items-start gap-2 text-[0.85em] text-left my-2 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={confirmedComplete}
                      onChange={(e) => setConfirmedComplete(e.target.checked)} />
                  {t('addNewToy:confirmCompleteLabel')}
              </label>}

          <div className="flex flex-col">
            <button type="submit"
                disabled={uploadingImage || uploadingVideo || images.length === 0 || (!isEditMode && !confirmedComplete) ||
                    ageMin.trim() === '' || ageMax.trim() === ''}
                className="self-end">
                {t(isEditMode ? 'addNewToy:saveChanges' : 'addNewToy:add')}
            </button>
          </div>
        </form>
      </>
    );
}

export default AddNew;
