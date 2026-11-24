import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

interface Props {
    enabling: boolean;
    onEnable: () => void;
    onDismiss: () => void;
}

// A dismissible bottom banner (not a blocking overlay - enabling push isn't
// required for anything) shown once right after sign-in while the browser's
// own permission is still undecided, see the effect in App.tsx's Layout.
function NotificationPrompt({ enabling, onEnable, onDismiss }: Props) {
    const { t } = useTranslation();

    return (
        <div className="card fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] flex items-center gap-3 p-4 max-w-[90vw] w-[420px]">
            <FontAwesomeIcon icon={faBell} className="text-primary text-[1.3em] shrink-0" />
            <p className="m-0 flex-1 text-[0.9em]">{t('common:notificationPrompt.body')}</p>
            <div className="flex flex-col gap-2 shrink-0">
                <button className="btn-primary" disabled={enabling} onClick={onEnable}>
                    {enabling ? t('common:notificationPrompt.enabling') : t('common:notificationPrompt.enable')}
                </button>
                <button onClick={onDismiss}>{t('common:notificationPrompt.notNow')}</button>
            </div>
        </div>
    );
}

export default NotificationPrompt;
