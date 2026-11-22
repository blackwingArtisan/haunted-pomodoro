/**
 * The tab's icon, drawn from code on a 32 by 32 canvas. Every distinct frame is drawn once, turned
 * into a data URL and kept, so after the first pass the painter only assigns a cached string to one
 * `<link rel="icon">`. No image is fetched. Where there is no canvas the static icon stays.
 */
import { WAX_STEPS, frameKey, type FaviconFrame } from '../core/favicon';

export interface FaviconPainter {
  /** Shows a frame. `idle` restores the static icon. */
  show(frame: FaviconFrame): void;
}

/** Copies of the tokens in `src/styles.css`; a unit test keeps them equal. */
export const FAVICON_COLORS = {
  night: '#0b0910',
  bone: '#efe6d2',
  brass: '#c9a25a',
  candle: '#ffbf5a',
  ecto: '#8ff5d2',
} as const;

export const FAVICON_SIZE = 32;

export type FaviconContext = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'fillRect'
  | 'beginPath'
  | 'moveTo'
  | 'quadraticCurveTo'
  | 'arc'
  | 'ellipse'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'globalAlpha'
>;

const BASE_TOP = 27;
const BREAK_WAX = 0.6;

/** Height in pixels of the candle's body: 3 at the last step so a stub stays visible, 18 when full. */
export function bodyHeight(step: number): number {
  return 3 + (15 * (WAX_STEPS - step)) / WAX_STEPS;
}

function drawCandle(ctx: FaviconContext, height: number, flame: string): void {
  // Brass base.
  ctx.fillStyle = FAVICON_COLORS.brass;
  ctx.fillRect(8, BASE_TOP, 16, 3);
  // Wax body.
  const top = BASE_TOP - height;
  ctx.fillStyle = FAVICON_COLORS.bone;
  ctx.fillRect(12, top, 8, height);
  // Glow, a teardrop flame and its paler core.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.arc(16, top - 4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(16, top - 10);
  ctx.quadraticCurveTo(21, top - 4, 16, top - 1);
  ctx.quadraticCurveTo(11, top - 4, 16, top - 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = FAVICON_COLORS.bone;
  ctx.beginPath();
  ctx.ellipse(16, top - 4, 1.5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGhost(ctx: FaviconContext, face: 0 | 1): void {
  const stretch = face === 1 ? 2 : 0;
  // A rounded sheet with a wavy hem.
  ctx.fillStyle = FAVICON_COLORS.ecto;
  ctx.beginPath();
  ctx.moveTo(5, 29);
  ctx.quadraticCurveTo(5, 4, 16, 4);
  ctx.quadraticCurveTo(27, 4, 27, 29);
  ctx.quadraticCurveTo(24, 25, 21.5, 29);
  ctx.quadraticCurveTo(19, 25, 16, 29);
  ctx.quadraticCurveTo(13, 25, 10.5, 29);
  ctx.quadraticCurveTo(8, 25, 5, 29);
  ctx.closePath();
  ctx.fill();
  // Two dark eyes and a small round mouth; face 1 stretches them by two pixels.
  ctx.fillStyle = FAVICON_COLORS.night;
  ctx.beginPath();
  ctx.ellipse(11.5, 14, 2, 2 + stretch / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(20.5, 14, 2, 2 + stretch / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(16, 21, 2, 2 + stretch / 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Draws one frame on a 32 by 32 canvas. `idle` draws nothing: the painter shows the static icon instead. */
export function drawFavicon(ctx: FaviconContext, frame: FaviconFrame): void {
  ctx.clearRect(0, 0, FAVICON_SIZE, FAVICON_SIZE);
  ctx.globalAlpha = 1;
  switch (frame.kind) {
    case 'idle':
      return;
    case 'candle':
      drawCandle(ctx, bodyHeight(frame.step), FAVICON_COLORS.candle);
      return;
    case 'break':
      drawCandle(ctx, 3 + 15 * BREAK_WAX, FAVICON_COLORS.ecto);
      return;
    case 'ghost':
      drawGhost(ctx, frame.face);
      return;
  }
}

export const noopFavicon: FaviconPainter = { show: () => undefined };

export class FakeFavicon implements FaviconPainter {
  frames: FaviconFrame[] = [];
  show(frame: FaviconFrame): void {
    this.frames.push(frame);
  }
}

/** The part of the document the painter uses, so a test can pass a small fake. */
type PainterDocument = Pick<Document, 'querySelector' | 'createElement'>;

export function createCanvasFavicon(doc: PainterDocument | undefined = typeof document === 'undefined' ? undefined : document): FaviconPainter {
  if (!doc) return noopFavicon;
  const cache = new Map<string, string>();
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let unavailable = false;
  let original: { href: string | null; type: string | null } | null = null;
  let lastKey: string | null = null;

  function link(): HTMLLinkElement | null {
    return doc!.querySelector<HTMLLinkElement>('link[rel="icon"]');
  }

  function render(frame: FaviconFrame): string | null {
    if (unavailable) return null;
    try {
      if (!canvas) {
        canvas = doc!.createElement('canvas');
        canvas.width = FAVICON_SIZE;
        canvas.height = FAVICON_SIZE;
        ctx = canvas.getContext('2d');
      }
      if (!ctx) {
        unavailable = true;
        return null;
      }
      drawFavicon(ctx, frame);
      return canvas.toDataURL('image/png');
    } catch {
      unavailable = true;
      return null;
    }
  }

  return {
    show(frame) {
      const key = frameKey(frame);
      if (key === lastKey) return;
      const el = link();
      if (!el) return;
      if (!original) original = { href: el.getAttribute('href'), type: el.getAttribute('type') };
      if (frame.kind === 'idle') {
        if (original.href !== null) el.setAttribute('href', original.href);
        if (original.type !== null) el.setAttribute('type', original.type);
        lastKey = key;
        return;
      }
      let url = cache.get(key);
      if (url === undefined) {
        const drawn = render(frame);
        if (drawn === null) return; // no canvas: the static icon stays
        url = drawn;
        cache.set(key, url);
      }
      el.setAttribute('href', url);
      el.setAttribute('type', 'image/png');
      lastKey = key;
    },
  };
}
