import { useMemo } from "react";
import { useTranslation } from "react-i18next";

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

// Shown for a couple of seconds right after successfully listing a brand
// new toy (addNewToy.tsx), before redirecting to /myToys. Each burst needs
// its own per-particle end position, which plain CSS classes can't express
// (every particle flies a different direction/distance) - so the keyframes
// are generated once per mount and injected via a <style> tag, rather than
// static rules in index.css.
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

function ToyListedCelebration() {
    const { t } = useTranslation();
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
            <h2 className="m-0 text-center">{t('addNewToy:celebrationThankYou')}</h2>
            <p className="m-0 text-text-dim text-center">{t('addNewToy:celebrationRedirecting')}</p>
        </div>
    );
}

export default ToyListedCelebration;
