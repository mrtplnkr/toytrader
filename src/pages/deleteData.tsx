import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useContextSelector } from "use-context-selector";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBackspace } from "@fortawesome/free-solid-svg-icons";
import { Store } from "react-notifications-component";
import { GoodAppContext } from "../hooks/context";
import { deleteMyAccount, deleteMyData } from "../hooks/helper";

const notify = (title: string, message: string, type: 'success' | 'danger') => {
    Store.addNotification({
        title,
        message,
        type,
        insert: "top",
        container: "top-right",
        animationIn: ["animated", "fadeIn"],
        animationOut: ["animated", "fadeOut"],
        dismiss: { duration: 6000, onScreen: true },
    });
};

function DeleteDataPage() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const signOut = useContextSelector(GoodAppContext, (state: any) => state.signOut);

    const [deletingData, setDeletingData] = useState(false);
    const [dataDone, setDataDone] = useState(false);

    const [deletingAccount, setDeletingAccount] = useState(false);

    const onDeleteData = async () => {
        if (!window.confirm(t('deleteData:confirmData'))) return;
        setDeletingData(true);
        try {
            const result = await deleteMyData();
            setDataDone(true);
            notify(t('deleteData:successTitle'),
                t('deleteData:successBody', { deleted: result.toysDeleted, kept: result.toysKept }),
                "success");
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
        } finally {
            setDeletingData(false);
        }
    };

    const onDeleteAccount = async () => {
        if (!window.confirm(t('deleteData:confirmAccount'))) return;
        setDeletingAccount(true);
        try {
            await deleteMyAccount();
            notify(t('deleteData:accountDeletedTitle'), t('deleteData:accountDeletedBody'), "success");
            await signOut();
            navigate('/');
        } catch (err) {
            notify(t('common:toast.actionFailedTitle'), t('common:toast.tryAgainLater'), "danger");
            setDeletingAccount(false);
        }
    };

    return (
        <>
            <div className="flex flex-col my-4">
                <button id="backButton" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon color="darkviolet" icon={faBackspace} />
                </button>
            </div>

            <h3>{t('deleteData:dataHeading')}</h3>

            <div className="card flex flex-col gap-3 max-w-[480px] mx-auto p-6">
                <p className="m-0 text-[0.9em] text-text-dim">{t('deleteData:dataIntro')}</p>

                <ul className="m-0 pl-5 flex flex-col gap-1 text-[0.9em] text-left">
                    <li>{t('deleteData:itemToys')}</li>
                    <li>{t('deleteData:itemShipping')}</li>
                    <li>{t('deleteData:itemNotifications')}</li>
                    <li>{t('deleteData:itemRatings')}</li>
                    <li>{t('deleteData:itemComplaints')}</li>
                </ul>

                <p className="m-0 text-[0.85em] text-text-dim">{t('deleteData:keptNote')}</p>

                {dataDone ?
                    <p className="m-0 text-[0.9em]">{t('deleteData:doneNote')}</p>
                :
                    <button className="btn-danger self-end" disabled={deletingData} onClick={onDeleteData}>
                        {deletingData ? t('deleteData:deleting') : t('deleteData:deleteDataButton')}
                    </button>}
            </div>

            <h3>{t('deleteData:accountHeading')}</h3>

            <div className="card flex flex-col gap-3 max-w-[480px] mx-auto p-6">
                <p className="m-0 text-[0.9em] text-text-dim">{t('deleteData:accountIntro')}</p>
                <p className="m-0 text-[0.85em] text-text-dim">{t('deleteData:accountKeptNote')}</p>

                <button className="btn-danger self-end" disabled={deletingAccount} onClick={onDeleteAccount}>
                    {deletingAccount ? t('deleteData:deleting') : t('deleteData:deleteAccountButton')}
                </button>
            </div>
        </>
    );
}

export default DeleteDataPage;
