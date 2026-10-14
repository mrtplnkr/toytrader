import { useMemo } from 'react';

const BUBBLE_COUNT = 15;

// Purely decorative, ambient background - fixed + pointer-events:none so it
// never intercepts clicks or affects layout of the real content above it.
function Bubbles() {
    const bubbles = useMemo(() => Array.from({ length: BUBBLE_COUNT }, (_, i) => ({
        id: i,
        size: 16 + Math.random() * 46,
        left: Math.random() * 100,
        duration: 10 + Math.random() * 14,
        delay: Math.random() * 12,
    })), []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Per-bubble values are random at runtime, so they can't be static
                Tailwind classes (the JIT scanner only sees literal strings in
                source) - inline style is the correct tool here, not a gap in
                the migration. */}
            {bubbles.map((b) => (
                <span
                    key={b.id}
                    className="absolute rounded-full border border-[rgba(124,92,255,0.25)]"
                    style={{
                        left: `${b.left}%`,
                        bottom: '-10%',
                        width: `${b.size}px`,
                        height: `${b.size}px`,
                        background: 'radial-gradient(circle at 30% 30%, rgba(124,92,255,0.35), rgba(124,92,255,0.05))',
                        animation: `bubble-rise ${b.duration}s linear ${b.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
}

export default Bubbles;
