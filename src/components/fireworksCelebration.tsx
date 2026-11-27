import { useMemo } from "react";

const BURST_COUNT = 3;
const PARTICLES_PER_BURST = 16;
const BURST_COLORS = ['#ff5c7a', '#e2b23a', '#33d69f', '#7c5cff', '#9179ff'];

interface Particle {
    id: string;
    keyframeName: string;
}

interface Burst {
    id: number;
    leftPct: number;
    topPct: number;
    color: string;
    delay: number;
    particles: Particle[];
}

interface Props {
    heading: string;
    body: string;
    // Omitted for a moment that's about to navigate away on its own (e.g.
    // addNewToy.tsx's auto-redirect timer) - shown for a moment the user
    // stays on the same page for instead (e.g. accepting a trade offer in
    // myOffers.tsx), where it needs its own way to dismiss. closeLabel is
    // required alongside it (not a hardcoded default) so this component
    // stays free of its own i18n dependency - the caller already has a
    // translated string ready either way.
    onClose?: () => void;
    closeLabel?: string;
}

// A quick, snappy celebratory flash - originally just for successfully
// listing a brand new toy (addNewToy.tsx), now reused for other one-off
// "something good just happened" moments (e.g. accepting a trade offer)
// that don't warrant the heavier HopGame-based FeedbackCelebration (that
// one's reserved for the single end-of-trade feedback moment). Each burst
// needs its own per-particle end position, which plain CSS classes can't
// express (every particle flies a different direction/distance) - so the
// keyframes are generated once per mount and injected via a <style> tag,
// rather than static rules in index.css.
function buildFireworks(): { bursts: Burst[]; keyframeCss: string } {
    let keyframeCss = '';
    const bursts: Burst[] = Array.from({ length: BURST_COUNT }, (_, burstIndex) => {
        const color = BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)];
        const particles: Particle[] = Array.from({ length: PARTICLES_PER_BURST }, (_, i) => {
            const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.3;
            const distance = 70 + Math.random() * 60;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            const keyframeName = `fw-${burstIndex}-${i}`;
            keyframeCss += `@keyframes ${keyframeName} {` +
                `0% { transform: translate(0, 0) scale(1); opacity: 1; }` +
                `100% { transform: translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.2); opacity: 0; }` +
                `}\n`;
            return { id: `${burstIndex}-${i}`, keyframeName };
        });
        return {
            id: burstIndex,
            leftPct: 20 + Math.random() * 60,
            topPct: 18 + Math.random() * 40,
            color,
            delay: burstIndex * 0.4,
            particles,
        };
    });
    return { bursts, keyframeCss };
}

function FireworksCelebration({ heading, body, onClose, closeLabel }: Props) {
    const { bursts, keyframeCss } = useMemo(buildFireworks, []);

    return (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-bg/90 backdrop-blur-sm p-4 overflow-hidden">
            <style>{keyframeCss}</style>
            <div className="absolute inset-0 pointer-events-none">
                {bursts.map((b) => (
                    <div key={b.id} className="absolute" style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}>
                        {b.particles.map((p) => (
                            <span
                                key={p.id}
                                className="absolute w-[6px] h-[6px] rounded-full"
                                style={{
                                    backgroundColor: b.color,
                                    boxShadow: `0 0 6px ${b.color}`,
                                    animation: `${p.keyframeName} 1s ease-out ${b.delay}s forwards`,
                                }}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <div className="text-[4em]">🎉</div>
            <h2 className="m-0 text-center">{heading}</h2>
            <p className="m-0 text-text-dim text-center">{body}</p>
            {onClose && <button className="btn-primary" onClick={onClose}>{closeLabel}</button>}
        </div>
    );
}

export default FireworksCelebration;
