import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

const WIDTH = 300;
const HEIGHT = 150;
const GROUND_Y = HEIGHT - 20;
const GRAVITY = 0.6;
const JUMP_VELOCITY = -9;
const CHARACTER_X = 30;
const CHARACTER_SIZE = 24;
const BEST_SCORE_KEY = "toytrader-hopgame-best";

interface Obstacle {
    x: number;
    width: number;
    height: number;
}

interface GameState {
    charY: number;
    velocity: number;
    jumping: boolean;
    obstacles: Obstacle[];
    speed: number;
    spawnTimer: number;
    frame: number;
    gameOver: boolean;
    score: number;
}

function freshState(): GameState {
    return {
        charY: GROUND_Y,
        velocity: 0,
        jumping: false,
        obstacles: [],
        speed: 4,
        spawnTimer: 0,
        frame: 0,
        gameOver: false,
        score: 0,
    };
}

function readBestScore(): number {
    try {
        return Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
    } catch {
        return 0;
    }
}

// A tiny "jump the obstacle" game, in the spirit of Chrome's offline dino
// game - shown as a playful distraction in two spots: the crash fallback
// (errorBoundary.tsx) and the celebration after leaving trade feedback
// (feedbackCelebration.tsx in myOffers.tsx). Drawn on a single <canvas>
// (not DOM nodes) so the per-frame physics loop doesn't fight React's own
// render cycle - state lives in a ref and only score/gameOver are mirrored
// into React state, just enough to re-render the text below the canvas.
function HopGame() {
    const { t } = useTranslation();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef<GameState>(freshState());
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(readBestScore);
    const [gameOver, setGameOver] = useState(false);

    const jump = () => {
        const s = stateRef.current;
        if (s.gameOver) {
            stateRef.current = freshState();
            setScore(0);
            setGameOver(false);
            return;
        }
        if (!s.jumping) {
            s.jumping = true;
            s.velocity = JUMP_VELOCITY;
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        let raf: number;

        const loop = () => {
            const s = stateRef.current;
            if (!s.gameOver) {
                s.frame++;
                s.velocity += GRAVITY;
                s.charY += s.velocity;
                if (s.charY >= GROUND_Y) {
                    s.charY = GROUND_Y;
                    s.velocity = 0;
                    s.jumping = false;
                }

                s.spawnTimer--;
                if (s.spawnTimer <= 0) {
                    s.obstacles.push({ x: WIDTH, width: 14 + Math.random() * 10, height: 20 + Math.random() * 16 });
                    s.spawnTimer = 60 + Math.random() * 50;
                }
                s.obstacles.forEach((o) => { o.x -= s.speed; });
                s.obstacles = s.obstacles.filter((o) => o.x + o.width > 0);

                // Ramps up slowly over the first ~10s, then holds - fast
                // enough to stay a little challenging, never unfair.
                s.speed = 4 + Math.min(4, s.frame / 600);

                if (s.frame % 6 === 0) {
                    s.score++;
                    setScore(s.score);
                }

                const charBox = { x: CHARACTER_X, y: s.charY - CHARACTER_SIZE, w: CHARACTER_SIZE, h: CHARACTER_SIZE };
                for (const o of s.obstacles) {
                    const obBox = { x: o.x, y: GROUND_Y - o.height, w: o.width, h: o.height };
                    if (charBox.x < obBox.x + obBox.w && charBox.x + charBox.w > obBox.x &&
                        charBox.y < obBox.y + obBox.h && charBox.y + charBox.h > obBox.y) {
                        s.gameOver = true;
                        setGameOver(true);
                        setBest((prevBest) => {
                            const next = Math.max(prevBest, s.score);
                            try { localStorage.setItem(BEST_SCORE_KEY, String(next)); } catch { /* ignore */ }
                            return next;
                        });
                        break;
                    }
                }
            }

            ctx.clearRect(0, 0, WIDTH, HEIGHT);
            ctx.strokeStyle = "#9a9db3";
            ctx.beginPath();
            ctx.moveTo(0, GROUND_Y);
            ctx.lineTo(WIDTH, GROUND_Y);
            ctx.stroke();

            ctx.font = `${CHARACTER_SIZE}px serif`;
            ctx.fillText("🧸", CHARACTER_X - CHARACTER_SIZE / 2, s.charY);
            s.obstacles.forEach((o) => {
                ctx.font = `${o.height}px serif`;
                ctx.fillText("🧱", o.x, GROUND_Y);
            });

            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.code === "Space" || e.code === "ArrowUp") {
                e.preventDefault();
                jump();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <div className="flex flex-col items-center gap-2">
            <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                onClick={jump}
                onTouchStart={(e) => { e.preventDefault(); jump(); }}
                className="max-w-full cursor-pointer touch-none rounded-sm border border-solid border-border bg-surface"
            />
            <div className="flex gap-4 text-[0.85em] text-text-dim">
                <span>{t('hopGame:score', { score })}</span>
                <span>{t('hopGame:best', { best })}</span>
            </div>
            {gameOver ?
                <button className="btn-primary" onClick={jump}>{t('hopGame:playAgain')}</button>
            :
                <p className="m-0 text-[0.8em] text-text-dim">{t('hopGame:instructions')}</p>}
        </div>
    );
}

export default HopGame;
