import { useState } from "react";
import { useTranslation } from "react-i18next";
import { saveAgeProfile } from "../hooks/helper";

interface Props {
    onSaved: () => void;
}

const SCHOOL_CLASSES = Array.from({ length: 12 }, (_, i) => i + 1);

// Shown once, right after a user's first sign-in (any method), if no
// ageProfile doc exists yet - see the effect in App.tsx's Layout. Neither
// Google nor Facebook sign-in reliably expose real age/birthdate (would
// need a separate, sensitive OAuth scope plus app review on each platform,
// and most users don't have it set/shared anyway), so this is self-reported
// here instead - deliberately not an exact birthdate: an 18+ attestation,
// or a school grade/class number if not, both lighter-weight than
// collecting a real date of birth from a child. No dismiss/cancel - this is
// a one-time, required step before the rest of the app otherwise behaves
// as if every signed-in user were an unspecified adult.
function AgeProfileModal({ onSaved }: Props) {
    const { t } = useTranslation();
    const [isAdult, setIsAdult] = useState(false);
    const [schoolClass, setSchoolClass] = useState('');
    const [saving, setSaving] = useState(false);

    const canConfirm = isAdult || schoolClass !== '';

    const onConfirm = async () => {
        if (!canConfirm || saving) return;
        setSaving(true);
        try {
            await saveAgeProfile(
                isAdult ? { isAdult: true } : { isAdult: false, schoolClass: Number(schoolClass) }
            );
            onSaved();
        } catch {
            // Best-effort - stays open to retry; nothing else in the app
            // depends on this being saved immediately.
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-4 bg-bg/90 backdrop-blur-sm p-4">
            <div className="card flex flex-col gap-4 max-w-[380px] p-6 text-left">
                <h3 className="m-0">{t('ageProfile:heading')}</h3>
                <p className="m-0 text-[0.9em] text-text-dim">{t('ageProfile:body')}</p>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAdult} onChange={(e) => setIsAdult(e.target.checked)} />
                    {t('ageProfile:isAdult')}
                </label>

                {!isAdult &&
                    <label className="flex flex-col gap-1">
                        <span className="text-[0.85em] text-text-dim">{t('ageProfile:schoolClassLabel')}</span>
                        <select value={schoolClass} onChange={(e) => setSchoolClass(e.target.value)}>
                            <option value="" disabled>{t('ageProfile:selectEllipsis')}</option>
                            {SCHOOL_CLASSES.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>}

                <button className="btn-primary self-end" disabled={!canConfirm || saving} onClick={onConfirm}>
                    {saving ? t('ageProfile:saving') : t('ageProfile:confirm')}
                </button>
            </div>
        </div>
    );
}

export default AgeProfileModal;
