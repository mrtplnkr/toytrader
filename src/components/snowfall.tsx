import { useMemo } from 'react';

const SNOWFLAKE_COUNT = 14;

// Purely decorative, ambient background - fixed + pointer-events:none so it
// never intercepts clicks or affects layout, same pattern as bubbles.tsx.
// Deliberately a handful of flakes ("a few"), not a blizzard.
function Snowfall() {
    const flakes = useMemo(() => Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 10 + Math.random() * 12,
        duration: 9 + Math.random() * 10,
        delay: Math.random() * 12,
        opacity: 0.35 + Math.random() * 0.4,
    })), []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Per-flake values are random at runtime, so they can't be
                static Tailwind classes - inline style is the right tool,
                same as components/bubbles.tsx. */}
            {flakes.map((f) => (
                <span
                    key={f.id}
                    className="absolute top-[-8%] text-white select-none"
                    style={{
                        left: `${f.left}%`,
                        fontSize: `${f.size}px`,
                        opacity: f.opacity,
                        animation: `snow-fall ${f.duration}s linear ${f.delay}s infinite`,
                    }}
                >
                    ❄
                </span>
            ))}
        </div>
    );
}

export default Snowfall;
