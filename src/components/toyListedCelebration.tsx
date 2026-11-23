import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const CONFETTI_COUNT = 40;
const CONFETTI_COLORS = ['#7c5cff', '#33d69f', '#e2b23a', '#ff5c7a', '#9179ff'];

// Shown for a couple of seconds right after successfully listing a brand
// new toy (addNewToy.tsx), before redirecting to /myToys - a CSS confetti
// burst rather than an actual .gif file, so there's no external asset to
// source or ship.
function ToyListedCelebration() {
    const { t } = useTranslation();

    const pieces = useMemo(() => Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        width: 6 + Math.random() * 7,
        height: 10 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        duration: 1.6 + Math.random() * 1.2,
        delay: Math.random() * 0.5,
    })), []);

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-bg/90 backdrop-blur-sm p-4 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                {/* Per-piece values are random at runtime, so they can't be
                    static Tailwind classes - inline style is the right tool,
                    same pattern as components/bubbles.tsx. */}
                {pieces.map((p) => (
                    <span
                        key={p.id}
                        className="absolute top-[-10%] rounded-[1px]"
                        style={{
                            left: `${p.left}%`,
                            width: `${p.width}px`,
                            height: `${p.height}px`,
                            backgroundColor: p.color,
                            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                        }}
                    />
                ))}
            </div>
            <div className="text-[4em]">🎉</div>
            <h2 className="m-0 text-center">{t('addNewToy:celebrationThankYou')}</h2>
            <p className="m-0 text-text-dim text-center">{t('addNewToy:celebrationRedirecting')}</p>
        </div>
    );
}

export default ToyListedCelebration;
