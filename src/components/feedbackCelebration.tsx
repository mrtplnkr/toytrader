import { useTranslation } from "react-i18next";
import HopGame from "./hopGame";

interface Props {
    onClose: () => void;
}

// Shown right after submitting a trade rating in myOffers.tsx - same
// full-screen-overlay pattern as fireworksCelebration.tsx, but with a quick
// playable distraction instead of a fireworks animation, and no auto-close
// (there's nowhere it needs to redirect to - the trade list is already
// right there underneath once this closes).
function FeedbackCelebration(props: Props) {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-bg/90 backdrop-blur-sm p-4">
            <div className="text-[3em]">🌟</div>
            <h2 className="m-0 text-center">{t('myOffers:feedbackCelebrationHeading')}</h2>
            <p className="m-0 max-w-[24em] text-center text-text-dim">{t('myOffers:feedbackCelebrationBody')}</p>
            <HopGame />
            <button className="btn-primary" onClick={props.onClose}>{t('myOffers:feedbackCelebrationClose')}</button>
        </div>
    );
}

export default FeedbackCelebration;
