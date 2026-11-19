import { useEffect, useId, useRef, type CSSProperties } from 'react';
import type { RoomDef, RoomProp } from '../core/house';
import type { Wisp } from '../core/wisps';
import { MANTEL_CANDLES } from './candles';

export type GhostMood = 'asleep' | 'watching' | 'awake' | 'calling';

export interface GhostView {
  closeness: number;
  mood: GhostMood;
}

export interface SceneProps {
  room: RoomDef;
  /** 0 haunted to 1 restored; includes progress through the burning candle. */
  restore: number;
  /** Candlesticks lit on the mantel, 0 to 4 (see mantelCandles), not the room's candle count. */
  candlesLit: number;
  /** The candlestick burning now, and how far it has burned (0 to 1). */
  burning: { index: number; melt: number } | null;
  /** Fully restored: the portrait sleeps, the cobwebs are gone. */
  restored: boolean;
  ghost: GhostView;
  rattling: boolean;
  breathing: boolean;
  /** 0 to 1: how warm the hearth fire burns, from the streak. */
  hearth: number;
  label: string;
  /** Will-o'-wisps the ghost has left today, one per return from a wandering (see src/core/wisps.ts). */
  wisps?: readonly Wisp[];
  trackPointer?: boolean;
  className?: string;
}

const CANDLE_X = [424, 480, 720, 776] as const;
/** The mantel candles are drawn at this scale around their base, so lighting one reads from across the room. */
const CANDLE_SCALE = 1.6;
/** The haunted room never drops below this much color, so it reads as moonlit rather than muddy. */
export const RESTORE_FLOOR = 0.08;
export const GHOST_SPOTS: ReadonlyArray<[number, number, number]> = [
  [186, 250, 0.42],
  [340, 330, 0.72],
  [860, 300, 1],
  // Closest: the ghost drifts toward the camera and fills the room.
  [600, 430, 1.8],
];

const NO_WISPS: readonly Wisp[] = [];

export function Scene(props: SceneProps) {
  const { room, restore, candlesLit, burning, restored, ghost, rattling, breathing, hearth, label, wisps = NO_WISPS, trackPointer = true } = props;
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pupilsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!trackPointer || restored) return;
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      const pupils = pupilsRef.current;
      if (!svg || !pupils) return;
      const box = svg.getBoundingClientRect();
      if (box.width === 0) return;
      const x = ((e.clientX - box.left) / box.width) * 1200;
      const y = ((e.clientY - box.top) / box.height) * 700;
      const dx = x - 600;
      const dy = y - 158;
      const len = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, len / 400) * 4.5;
      pupils.style.transform = `translate(${(dx / len) * reach}px, ${(dy / len) * reach * 0.6}px)`;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [trackPointer, restored]);

  const spot = GHOST_SPOTS[Math.min(3, Math.max(0, Math.round(ghost.closeness)))]!;
  const ghostStyle: CSSProperties = { transform: `translate(${spot[0]}px, ${spot[1]}px) scale(${spot[2]})` };
  const r = restored ? 1 : Math.min(1, Math.max(RESTORE_FLOOR, restore));
  const sceneStyle = { '--restore': r, '--hearth': hearth, '--lit': (candlesLit + (burning ? 1 : 0)) / MANTEL_CANDLES } as CSSProperties;
  const [paper, motif] = room.paper;

  return (
    <svg
      ref={svgRef}
      className={['scene', props.className, breathing ? 'is-breathing' : '', restored ? 'is-restored' : '', rattling ? 'is-rattling' : ''].filter(Boolean).join(' ')}
      viewBox="0 0 1200 700"
      role="img"
      aria-label={label}
      style={sceneStyle}
      data-room={room.id}
      data-restored={restored ? 'true' : 'false'}
      data-ghost={ghost.mood}
      data-ghost-closeness={Math.round(ghost.closeness)}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id={`paper-${uid}`} width="80" height="96" patternUnits="userSpaceOnUse">
          <rect width="80" height="96" fill={paper} />
          <path d="M40 10 C52 26 52 38 40 48 C28 38 28 26 40 10 Z M40 48 C56 56 62 72 40 86 C18 72 24 56 40 48 Z" fill={motif} opacity="0.55" />
          <circle cx="0" cy="48" r="5" fill={motif} opacity="0.5" />
          <circle cx="80" cy="48" r="5" fill={motif} opacity="0.5" />
          <path d="M0 0 V96 M80 0 V96" stroke="#000" strokeOpacity="0.12" strokeWidth="2" />
        </pattern>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1530" />
          <stop offset="1" stopColor="#2a2350" />
        </linearGradient>
        <linearGradient id={`floor-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b1a14" />
          <stop offset="1" stopColor="#120a08" />
        </linearGradient>
        <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffcf7a" stopOpacity="0.9" />
          <stop offset="0.4" stopColor="#ff9d3d" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ff9d3d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`vignette-${uid}`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </radialGradient>
        <radialGradient id={`ecto-${uid}`} cx="0.5" cy="0.45" r="0.55">
          <stop offset="0" stopColor="#f4fffb" />
          <stop offset="0.65" stopColor="#c9fbe8" />
          <stop offset="1" stopColor="#8ff5d2" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id={`beam-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9c8ff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#b9c8ff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`wisp-${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c9fbe8" stopOpacity="0.85" />
          <stop offset="0.45" stopColor="#8ff5d2" stopOpacity="0.32" />
          <stop offset="1" stopColor="#8ff5d2" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`ghost-vignette-${uid}`} cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.5" stopColor="#8ff5d2" stopOpacity="0" />
          <stop offset="1" stopColor="#8ff5d2" stopOpacity="0.55" />
        </radialGradient>
        <linearGradient id={`sweep-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0" />
          <stop offset="0.6" stopColor="#ffe6b0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </linearGradient>
        <filter id={`soft-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <clipPath id={`window-${uid}`}>
          <path d="M80 380 V180 A110 110 0 0 1 300 180 V380 Z" />
        </clipPath>
      </defs>

      <g className="room">
        <rect width="1200" height="520" fill={`url(#paper-${uid})`} />
        <rect width="1200" height="520" fill="#06040a" className="room-shade" />
        {/* Wainscot */}
        <rect y="400" width="1200" height="120" fill="#24160f" />
        <rect y="398" width="1200" height="8" fill="#3d2618" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={20 + i * 120} y="420" width="96" height="84" rx="4" fill="none" stroke="#3a2416" strokeWidth="4" />
        ))}
        {/* Floor */}
        <rect y="520" width="1200" height="180" fill={`url(#floor-${uid})`} />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="0" x2="1200" y1={540 + i * 22} y2={540 + i * 22} stroke="#000" strokeOpacity="0.35" strokeWidth="2" />
        ))}
        <ellipse cx="600" cy="620" rx="360" ry="58" fill="#4a1d2a" />
        <ellipse cx="600" cy="620" rx="330" ry="46" fill="none" stroke="#c9a25a" strokeOpacity="0.45" strokeWidth="4" strokeDasharray="14 10" />

        <WindowFrame uid={uid} />
        <Fireplace />
        <Portrait restored={restored} pupilsRef={pupilsRef} />
        <Prop prop={room.prop} restored={restored} />
        {CANDLE_X.map((x, i) => (
          <Candle key={i} uid={uid} x={x} state={i < candlesLit ? 'lit' : burning && burning.index === i ? 'burning' : 'unlit'} melt={burning && burning.index === i ? burning.melt : 0} />
        ))}
        <Cobwebs />
      </g>

      {/* Light: moon shaft, candle warmth, vignette */}
      <polygon points="120,190 300,190 780,700 250,700" fill={`url(#beam-${uid})`} className="moonbeam" filter={`url(#soft-${uid})`} />
      {/* Cold moonlit cast while the room is haunted; it lifts as the room is restored. */}
      <rect width="1200" height="700" fill="#1b2a5a" className="haunt-cast" pointerEvents="none" />
      <ellipse cx="600" cy="270" rx="520" ry="360" fill={`url(#glow-${uid})`} className="candle-warmth" />
      <g className="motes" aria-hidden="true">
        {[
          [260, 300],
          [420, 220],
          [880, 260],
          [700, 360],
          [980, 180],
          [520, 420],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 3} fill="#ffe8b0" opacity="0.5" style={{ animationDelay: `${i * -2.3}s` }} />
        ))}
      </g>

      {/* One small light per return today. Decorative: the scene label says how many. */}
      <g className="wisps" aria-hidden="true" data-testid="wisps" data-count={wisps.length}>
        {wisps.map((w, i) => (
          <g key={i} className="wisp" transform={`translate(${w.x} ${w.y})`}>
            <g className="wisp-float" style={{ animationDelay: `${w.phase}s` }}>
              <circle r={w.r * 3.4} fill={`url(#wisp-${uid})`} className="wisp-halo" />
              <circle r={w.r} fill="#e9fff7" className="wisp-core" />
            </g>
          </g>
        ))}
      </g>

      <g className="ghost" style={ghostStyle} data-testid="ghost">
        <Ghost uid={uid} mood={ghost.mood} />
      </g>

      <rect width="1200" height="700" fill={`url(#vignette-${uid})`} pointerEvents="none" />
      {/* The closer the ghost, the more the room's edges glow its color. */}
      <rect width="1200" height="700" fill={`url(#ghost-vignette-${uid})`} className="ghost-vignette" pointerEvents="none" data-testid="ghost-vignette" />
      <rect width="1200" height="700" className="restore-flash" fill="#ffd98a" pointerEvents="none" />
      {restored && (
        <g className="restore-sweep" aria-hidden="true" data-testid="restore-sweep">
          <rect x="-520" y="0" width="520" height="700" fill={`url(#sweep-${uid})`} className="sweep-band" />
          <g className="dust-burst">
            {Array.from({ length: 16 }, (_, i) => {
              const a = (i / 16) * Math.PI * 2;
              const reach = 140 + (i % 4) * 45;
              return (
                <circle
                  key={i}
                  cx="600"
                  cy="300"
                  r={2 + (i % 3)}
                  fill="#f3e2bd"
                  style={{ '--dx': `${Math.cos(a) * reach}px`, '--dy': `${Math.sin(a) * reach * 0.7}px` } as CSSProperties}
                />
              );
            })}
          </g>
        </g>
      )}
      {restored && (
        <g className="embers-rise" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <circle key={i} cx={120 + ((i * 397) % 960)} cy={560 + ((i * 53) % 120)} r={2 + (i % 3)} fill={i % 2 ? '#ffd98a' : '#fff4dc'} style={{ animationDelay: `${(i % 6) * 0.35}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

function WindowFrame({ uid }: { uid: string }) {
  return (
    <g className="window">
      <g clipPath={`url(#window-${uid})`}>
        <rect x="80" y="60" width="220" height="330" fill={`url(#sky-${uid})`} />
        <circle cx="236" cy="150" r="34" fill="#f3efd8" />
        <circle cx="222" cy="142" r="6" fill="#d8d2b5" />
        <circle cx="246" cy="164" r="4" fill="#d8d2b5" />
        {[
          [110, 120],
          [150, 210],
          [270, 250],
          [130, 300],
          [200, 110],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.6" fill="#fff" className="star" style={{ animationDelay: `${i * 0.7}s` }} />
        ))}
        <g className="clouds">
          <path d="M60 230 q30 -26 60 -6 q24 -18 48 4 q22 4 18 18 h-132 z" fill="#3b3466" opacity="0.8" />
          <path d="M190 300 q26 -20 52 -4 q22 -14 42 4 q18 4 14 16 h-112 z" fill="#3b3466" opacity="0.7" />
        </g>
        {/* Hill and a bare tree outside */}
        <path d="M80 360 Q170 320 300 350 V390 H80 Z" fill="#0a0d18" />
        <path d="M120 350 v-40 m0 14 l-14 -12 m14 4 l12 -16 m-12 30 l18 -6" stroke="#0a0d18" strokeWidth="4" fill="none" />
      </g>
      <path d="M80 380 V180 A110 110 0 0 1 300 180 V380 Z" fill="none" stroke="#2a1a10" strokeWidth="14" />
      <path d="M190 72 V380 M80 260 H300" stroke="#2a1a10" strokeWidth="8" />
      <rect x="66" y="378" width="248" height="16" rx="3" fill="#3d2618" />
      {/* Curtains */}
      <g className="curtain curtain-left">
        <path d="M44 52 C70 160 54 300 78 400 L30 400 C20 300 36 160 20 52 Z" fill="#5d1a2a" />
        <path d="M30 52 C44 160 34 300 46 400" stroke="#3a0f1a" strokeWidth="5" fill="none" />
      </g>
      <g className="curtain curtain-right">
        <path d="M336 52 C310 160 326 300 302 400 L350 400 C360 300 344 160 360 52 Z" fill="#5d1a2a" />
        <path d="M350 52 C336 160 346 300 334 400" stroke="#3a0f1a" strokeWidth="5" fill="none" />
      </g>
      <rect x="14" y="42" width="352" height="18" rx="6" fill="#c9a25a" opacity="0.85" />
    </g>
  );
}

function Fireplace() {
  return (
    <g className="fireplace">
      <rect x="452" y="318" width="296" height="202" fill="#2e2320" />
      <rect x="452" y="318" width="296" height="202" fill="none" stroke="#45352f" strokeWidth="6" />
      <path d="M512 520 V430 A88 88 0 0 1 688 430 V520 Z" fill="#0a0605" />
      <g className="fire">
        <ellipse cx="600" cy="512" rx="80" ry="14" fill="#ff6a1f" opacity="0.5" className="embers" />
        <path className="flame f1" d="M560 512 C548 480 572 470 566 440 C590 462 600 486 592 512 Z" fill="#ff8a3d" />
        <path className="flame f2" d="M590 512 C578 470 606 452 600 414 C632 446 640 482 620 512 Z" fill="#ffbf5a" />
        <path className="flame f3" d="M618 512 C612 486 630 476 628 452 C650 474 652 494 640 512 Z" fill="#ff8a3d" />
        <rect x="548" y="508" width="104" height="10" rx="5" fill="#3a2015" />
      </g>
      {/* Mantel shelf, wide enough for the four large candlesticks */}
      <rect x="388" y="300" width="424" height="20" rx="3" fill="#4a2f1f" />
      <rect x="398" y="318" width="404" height="6" fill="#2a1a10" />
    </g>
  );
}

function Portrait({ restored, pupilsRef }: { restored: boolean; pupilsRef: React.Ref<SVGGElement> }) {
  return (
    <g className="portrait">
      <rect x="504" y="66" width="192" height="210" rx="6" fill="#8a6a2c" />
      <rect x="512" y="74" width="176" height="194" rx="4" fill="none" stroke="#e0bf6e" strokeWidth="3" />
      <rect x="522" y="84" width="156" height="174" fill="#1d1a2b" />
      <ellipse cx="600" cy="170" rx="70" ry="80" fill="#2c2840" />
      {/* Sitter: high collar, hair piled high */}
      <path d="M528 258 C536 214 566 200 600 200 C634 200 664 214 672 258 Z" fill="#14121c" />
      <path d="M584 196 L600 214 L616 196 Z" fill="#d9cfb8" opacity="0.8" />
      <ellipse cx="600" cy="160" rx="32" ry="40" fill="#cdbfa6" className="face" />
      <path d="M566 150 C566 104 634 104 634 150 C628 128 572 128 566 150 Z" fill="#2a1d18" />
      <ellipse cx="600" cy="110" rx="22" ry="14" fill="#2a1d18" />
      {restored ? (
        <g className="eyes-closed" stroke="#3a2a22" strokeWidth="2.5" fill="none" strokeLinecap="round">
          <path d="M580 160 q7 5 14 0" />
          <path d="M606 160 q7 5 14 0" />
          <path d="M590 182 q10 6 20 0" />
        </g>
      ) : (
        <g className="eyes-open">
          <ellipse cx="587" cy="158" rx="8" ry="5" fill="#fff7d6" />
          <ellipse cx="613" cy="158" rx="8" ry="5" fill="#fff7d6" />
          <g ref={pupilsRef} className="pupils">
            <circle cx="587" cy="158" r="3.2" fill="#b3122e" />
            <circle cx="613" cy="158" r="3.2" fill="#b3122e" />
          </g>
          <ellipse cx="587" cy="158" rx="12" ry="8" fill="#ff4d5e" className="eye-glow" />
          <ellipse cx="613" cy="158" rx="12" ry="8" fill="#ff4d5e" className="eye-glow" />
          <path d="M590 184 h20" stroke="#3a2a22" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      <rect x="560" y="276" width="80" height="4" fill="#5a4320" />
    </g>
  );
}

function Candle({ uid, x, state, melt }: { uid: string; x: number; state: 'lit' | 'burning' | 'unlit'; melt: number }) {
  const height = state === 'burning' ? 56 - melt * 30 : state === 'lit' ? 40 : 56;
  const top = 296 - height;
  return (
    <g className={`candle candle-${state}`} data-candle={state} transform={`translate(${x} 298) scale(${CANDLE_SCALE}) translate(${-x} -298)`}>
      <ellipse cx={x} cy="298" rx="18" ry="5" fill="#c9a25a" />
      <rect x={x - 4} y="288" width="8" height="10" fill="#a8843f" />
      <rect x={x - 9} y={top} width="18" height={height} rx="3" fill="#efe3c4" />
      <path d={`M${x - 9} ${top + 6} q4 10 0 16`} stroke="#d8c89f" strokeWidth="3" fill="none" />
      <line x1={x} x2={x} y1={top} y2={top - 7} stroke="#2a1a10" strokeWidth="2" />
      {state === 'burning' && <circle className="flare" cx={x} cy={top - 16} r="70" fill={`url(#glow-${uid})`} style={{ transformOrigin: `${x}px ${top - 16}px` }} />}
      {state !== 'unlit' && (
        <g className="flame-group" style={{ transformOrigin: `${x}px ${top - 4}px` }}>
          <circle cx={x} cy={top - 16} r="26" fill="#ffbf5a" opacity="0.18" />
          <path d={`M${x} ${top - 30} C${x + 9} ${top - 16} ${x + 7} ${top - 4} ${x} ${top - 3} C${x - 7} ${top - 4} ${x - 9} ${top - 16} ${x} ${top - 30} Z`} fill="#ffcf6a" />
          <path d={`M${x} ${top - 20} C${x + 4} ${top - 12} ${x + 3} ${top - 6} ${x} ${top - 5} C${x - 3} ${top - 6} ${x - 4} ${top - 12} ${x} ${top - 20} Z`} fill="#fff6d8" />
        </g>
      )}
      {state === 'unlit' && <path className="smoke" d={`M${x} ${top - 8} q-6 -12 0 -22 q6 -10 0 -22`} stroke="#c8c0b0" strokeWidth="2" fill="none" opacity="0.35" />}
    </g>
  );
}

function Cobwebs() {
  const web = (cx: number, cy: number, sx: number, sy: number, size: number, key: string) => {
    const spokes = [0, 22, 45, 68, 90].map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return [cx + sx * Math.cos(rad) * size, cy + sy * Math.sin(rad) * size] as const;
    });
    const rings = [0.3, 0.55, 0.8, 1].map((f) =>
      spokes.map(([x, y], i) => `${i === 0 ? 'M' : 'Q'}${i === 0 ? '' : `${cx + (x - cx) * f * 0.8 + sx * 4},${cy + (y - cy) * f * 0.8 + sy * 4} `}${cx + (x - cx) * f},${cy + (y - cy) * f}`).join(' '),
    );
    return (
      <g key={key} className="web">
        {spokes.map(([x, y], i) => (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} />
        ))}
        {rings.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    );
  };
  return (
    <g className="cobwebs" data-testid="cobwebs" stroke="#eef0ff" strokeWidth="1.4" fill="none" strokeOpacity="0.7">
      {web(0, 0, 1, 1, 190, 'tl')}
      {web(1200, 0, -1, 1, 170, 'tr')}
      {web(696, 66, -1, 1, 70, 'portrait')}
      {web(420, 320, 1, 1, 46, 'mantel')}
      <path d="M1040 0 C1046 60 1036 90 1046 120" />
      <circle cx="1046" cy="124" r="6" fill="#1a1420" stroke="none" className="spider" />
    </g>
  );
}

function Prop({ prop, restored }: { prop: RoomProp; restored: boolean }) {
  switch (prop) {
    case 'clock':
      return (
        <g className="prop prop-clock">
          <rect x="950" y="120" width="104" height="400" rx="6" fill="#3a2214" />
          <path d="M944 130 Q1002 70 1060 130 Z" fill="#4a2c1a" />
          <circle cx="1002" cy="190" r="38" fill="#e8dcc0" stroke="#c9a25a" strokeWidth="5" />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <circle key={i} cx={1002 + Math.sin(a) * 30} cy={190 - Math.cos(a) * 30} r="2" fill="#3a2214" />;
          })}
          <g className={restored ? 'clock-hands ticking' : 'clock-hands'} style={{ transformOrigin: '1002px 190px' }}>
            <line x1="1002" y1="190" x2="1002" y2="164" stroke="#1a1010" strokeWidth="4" strokeLinecap="round" />
            <line x1="1002" y1="190" x2={restored ? 1022 : 1002} y2={restored ? 196 : 158} stroke="#1a1010" strokeWidth="3" strokeLinecap="round" />
          </g>
          <rect x="972" y="260" width="60" height="200" rx="30" fill="#140c08" stroke="#c9a25a" strokeOpacity="0.4" strokeWidth="3" />
          <g className={restored ? 'pendulum swinging' : 'pendulum'} style={{ transformOrigin: '1002px 266px' }}>
            <line x1="1002" y1="266" x2="1002" y2="410" stroke="#c9a25a" strokeWidth="3" />
            <circle cx="1002" cy="414" r="16" fill="#e0bf6e" />
          </g>
        </g>
      );
    case 'books':
      return (
        <g className="prop prop-books">
          <rect x="880" y="110" width="260" height="410" fill="#2e1a10" />
          {[0, 1, 2, 3].map((shelf) => (
            <g key={shelf}>
              <rect x="880" y={196 + shelf * 92} width="260" height="10" fill="#4a2c1a" />
              {Array.from({ length: 9 }, (_, i) => {
                const h = 56 + ((i * 37 + shelf * 13) % 26);
                const colors = ['#6b2a2a', '#2a4a3a', '#5a4a1f', '#3a3060', '#7a5a2a'];
                const tilt = !restored && (i + shelf) % 5 === 2;
                return (
                  <rect
                    key={i}
                    className={tilt ? 'book floating' : 'book'}
                    x={892 + i * 27}
                    y={196 + shelf * 92 - h}
                    width="22"
                    height={h}
                    fill={colors[(i + shelf) % colors.length]}
                    style={{ transformOrigin: `${903 + i * 27}px ${196 + shelf * 92}px`, animationDelay: `${(i + shelf) * 0.4}s` }}
                  />
                );
              })}
            </g>
          ))}
          <rect x="872" y="100" width="276" height="14" fill="#4a2c1a" />
        </g>
      );
    case 'fern':
      return (
        <g className="prop prop-fern">
          <path d="M880 520 V180 A130 130 0 0 1 1140 180 V520" fill="#1a2a2a" opacity="0.6" stroke="#5a6a5a" strokeWidth="6" />
          <path d="M1010 60 V520 M880 300 H1140" stroke="#5a6a5a" strokeWidth="4" />
          <path d="M960 520 L976 440 H1044 L1060 520 Z" fill="#7a3d2a" />
          <g className={restored ? 'fronds' : 'fronds drooping'} style={{ transformOrigin: '1010px 440px' }} fill="none" strokeWidth="7" strokeLinecap="round">
            <path d="M1010 440 C990 380 940 360 910 330" stroke="#3f7a3a" />
            <path d="M1010 440 C1010 370 1000 320 1010 270" stroke="#4f8a42" />
            <path d="M1010 440 C1030 380 1080 360 1110 330" stroke="#3f7a3a" />
            <path d="M1010 440 C980 400 950 410 920 400" stroke="#5a9a4a" />
            <path d="M1010 440 C1040 400 1070 410 1100 400" stroke="#5a9a4a" />
          </g>
        </g>
      );
    case 'piano':
      return (
        <g className="prop prop-piano">
          <rect x="876" y="250" width="250" height="270" rx="6" fill="#140e12" />
          <rect x="876" y="240" width="258" height="16" rx="4" fill="#2a1c22" />
          <rect x="890" y="380" width="222" height="30" fill="#efe6d2" />
          {Array.from({ length: 15 }, (_, i) => (
            <line key={i} x1={890 + i * 14.8} x2={890 + i * 14.8} y1="380" y2="410" stroke="#140e12" strokeWidth="1.5" />
          ))}
          {Array.from({ length: 14 }, (_, i) =>
            [2, 6, 9, 13].includes(i) ? null : <rect key={i} x={899 + i * 14.8} y="380" width="8" height="18" fill="#140e12" className={!restored && i === 4 ? 'key-press' : ''} />,
          )}
          <rect x="960" y="300" width="80" height="54" fill="#efe6d2" opacity="0.85" transform="rotate(-4 1000 327)" />
          <path d="M970 316 h56 M970 328 h56 M970 340 h40" stroke="#3a2a22" strokeWidth="1.5" transform="rotate(-4 1000 327)" />
          <rect x="900" y="470" width="200" height="12" fill="#2a1c22" />
        </g>
      );
    case 'horse':
      return (
        <g className="prop prop-horse">
          <g className={restored ? 'horse' : 'horse rocking'} style={{ transformOrigin: '1005px 520px' }}>
            <path d="M890 498 Q1005 548 1120 498" stroke="#7a4a20" strokeWidth="12" fill="none" strokeLinecap="round" />
            <g stroke="#a8875a" strokeWidth="9" strokeLinecap="round">
              <line x1="955" y1="430" x2="935" y2="500" />
              <line x1="975" y1="436" x2="968" y2="510" />
              <line x1="1035" y1="436" x2="1042" y2="510" />
              <line x1="1052" y1="430" x2="1072" y2="500" />
            </g>
            <path d="M935 410 Q905 420 900 470" stroke="#8a2a2a" strokeWidth="10" fill="none" strokeLinecap="round" />
            <ellipse cx="1004" cy="414" rx="72" ry="30" fill="#e3d4b4" />
            <path d="M1046 404 Q1060 370 1072 344 L1094 352 Q1080 384 1072 414 Z" fill="#e3d4b4" />
            <ellipse cx="1096" cy="346" rx="30" ry="15" fill="#e3d4b4" transform="rotate(22 1096 346)" />
            <path d="M1074 332 l4 -18 l10 14 Z" fill="#e3d4b4" />
            <path d="M1064 344 Q1050 372 1046 400 M1070 350 Q1060 376 1058 396" stroke="#8a2a2a" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="1094" cy="340" r="3.5" fill="#1a1010" />
            <rect x="986" y="384" width="40" height="16" rx="5" fill="#8a2a2a" />
            <path d="M1006 400 v26" stroke="#c9a25a" strokeWidth="3" />
          </g>
          <rect x="900" y="170" width="200" height="120" rx="8" fill="#3a2c1a" opacity="0.7" />
          <path d="M920 250 l30 -50 l30 50 l30 -40 l30 40 l30 -60 l30 60" stroke="#c9a25a" strokeWidth="3" fill="none" opacity="0.7" />
        </g>
      );
    case 'telescope':
      return (
        <g className="prop prop-telescope">
          <circle cx="1010" cy="200" r="110" fill="#14203a" stroke="#c9a25a" strokeWidth="4" opacity="0.8" />
          {[
            [960, 160],
            [1040, 150],
            [1010, 230],
            [1070, 220],
            [980, 260],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#f3efd8" className={restored ? 'chart-star' : 'chart-star smudged'} />
          ))}
          <path d="M960 160 L1040 150 L1070 220 L1010 230 Z" stroke="#c9a25a" strokeWidth="1" fill="none" opacity={restored ? 0.8 : 0.2} />
          <g className={restored ? 'scope' : 'scope drifting'} style={{ transformOrigin: '1000px 380px' }}>
            <rect x="900" y="360" width="200" height="34" rx="12" fill="#c9a25a" transform="rotate(-24 1000 377)" />
            <rect x="1080" y="350" width="30" height="50" rx="6" fill="#8a6a2c" transform="rotate(-24 1000 377)" />
          </g>
          <path d="M1000 390 L950 520 M1000 390 L1050 520 M1000 390 V520" stroke="#5a3418" strokeWidth="7" />
        </g>
      );
  }
}

function Ghost({ uid, mood }: { uid: string; mood: GhostMood }) {
  const awake = mood === 'awake' || mood === 'calling';
  return (
    <g className={`ghost-body ghost-${mood}`}>
      <ellipse cx="0" cy="96" rx="56" ry="10" fill="#8ff5d2" opacity="0.18" className="ghost-shadow" />
      <path
        d="M-58 70 C-62 -10 -40 -70 0 -70 C40 -70 62 -10 58 70 Q44 60 32 74 Q20 88 8 72 Q-4 60 -16 76 Q-30 90 -40 70 Q-50 60 -58 70 Z"
        fill={`url(#ecto-${uid})`}
        opacity="0.92"
      />
      <path d="M-56 20 C-80 24 -86 6 -78 -8" stroke="#dffcf1" strokeWidth="12" strokeLinecap="round" fill="none" className="arm arm-left" />
      <path d="M56 20 C80 24 86 6 78 -8" stroke="#dffcf1" strokeWidth="12" strokeLinecap="round" fill="none" className="arm arm-right" />
      {awake ? (
        <g>
          <ellipse cx="-18" cy="-18" rx="9" ry="13" fill="#141020" />
          <ellipse cx="18" cy="-18" rx="9" ry="13" fill="#141020" />
          <circle cx="-15" cy="-22" r="3" fill="#fff" />
          <circle cx="21" cy="-22" r="3" fill="#fff" />
          <ellipse cx="0" cy="14" rx="10" ry={mood === 'calling' ? 14 : 9} fill="#141020" className="ghost-mouth" />
        </g>
      ) : mood === 'watching' ? (
        <g>
          <path d="M-28 -18 h20 M8 -18 h20" stroke="#141020" strokeWidth="5" strokeLinecap="round" />
          <circle cx="-18" cy="-14" r="4" fill="#141020" />
          <circle cx="18" cy="-14" r="4" fill="#141020" />
          <path d="M-8 14 q8 -4 16 0" stroke="#141020" strokeWidth="4" fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <g>
          <path d="M-28 -16 q10 8 20 0 M8 -16 q10 8 20 0" stroke="#141020" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M-6 12 q6 4 12 0" stroke="#141020" strokeWidth="3" fill="none" strokeLinecap="round" />
          <g className="zzz" fill="#dffcf1" fontFamily="Cinzel, serif" fontWeight="700">
            <text x="50" y="-60" fontSize="26">z</text>
            <text x="72" y="-86" fontSize="20">z</text>
            <text x="88" y="-106" fontSize="14">z</text>
          </g>
        </g>
      )}
    </g>
  );
}
