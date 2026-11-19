/**
 * Draws the end-of-week postcard (see `src/core/postcard.ts`) onto a 1200x630 canvas, the size link
 * previews use, and hands it back as a PNG. The house is the same one the house map shows: a lamp in
 * every restored window, the ghost in the window of the room being restored today.
 */
import type { Postcard } from '../core/postcard';

export const POSTCARD_WIDTH = 1200;
export const POSTCARD_HEIGHT = 630;

const DISPLAY = "'IM Fell English SC', 'Cormorant Garamond', Georgia, serif";
const BODY = "'Cormorant Garamond', Georgia, serif";

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawHouse(ctx: CanvasRenderingContext2D, card: Postcard, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // Roof, chimney and attic window.
  ctx.fillStyle = '#1d1626';
  ctx.strokeStyle = 'rgba(201, 162, 90, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(44, 128);
  ctx.lineTo(180, 52);
  ctx.lineTo(316, 128);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(250, 62, 20, 44);
  ctx.strokeRect(250, 62, 20, 44);
  const complete = card.windows.every((w) => w === 'restored');
  ctx.beginPath();
  ctx.arc(180, 100, 12, 0, Math.PI * 2);
  ctx.fillStyle = complete ? '#ffbf5a' : '#0a0810';
  ctx.fill();
  ctx.stroke();
  // The house front.
  ctx.fillStyle = '#16111d';
  ctx.fillRect(56, 126, 248, 170);
  ctx.strokeRect(56, 126, 248, 170);
  card.windows.forEach((state, i) => {
    const wx = 78 + (i % 3) * 76;
    const wy = 144 + Math.floor(i / 3) * 66;
    if (state === 'restored') {
      const glow = ctx.createRadialGradient(wx + 24, wy + 26, 4, wx + 24, wy + 26, 46);
      glow.addColorStop(0, 'rgba(255, 191, 90, 0.55)');
      glow.addColorStop(1, 'rgba(255, 191, 90, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx - 24, wy - 22, 96, 96);
    }
    ctx.beginPath();
    ctx.moveTo(wx, wy + 50);
    ctx.lineTo(wx, wy + 22);
    ctx.ellipse(wx + 24, wy + 22, 24, 22, 0, Math.PI, 0);
    ctx.lineTo(wx + 48, wy + 50);
    ctx.closePath();
    ctx.fillStyle = state === 'restored' ? '#ffcf7a' : state === 'today' ? '#2a3550' : '#0b0910';
    ctx.fill();
    if (state === 'today') {
      // The ghost, waiting in the room being restored.
      ctx.fillStyle = '#c9fbe8';
      ctx.beginPath();
      ctx.moveTo(wx + 12, wy + 47);
      ctx.lineTo(wx + 12, wy + 31);
      ctx.bezierCurveTo(wx + 12, wy + 24, wx + 15, wy + 16, wx + 24, wy + 16);
      ctx.bezierCurveTo(wx + 33, wy + 16, wx + 36, wy + 24, wx + 36, wy + 31);
      ctx.lineTo(wx + 36, wy + 47);
      for (let k = 0; k < 6; k++) ctx.lineTo(wx + 32 - k * 4, wy + (k % 2 ? 47 : 44));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#16111d';
      for (const ex of [20, 28]) {
        ctx.beginPath();
        ctx.arc(wx + ex, wy + 29, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = '#0b0910';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx + 24, wy);
    ctx.lineTo(wx + 24, wy + 50);
    ctx.moveTo(wx, wy + 28);
    ctx.lineTo(wx + 48, wy + 28);
    ctx.stroke();
  });
  ctx.restore();
}

/** Paints the card onto a canvas the caller provides (1200x630). */
export function paintPostcard(canvas: HTMLCanvasElement, card: Postcard): void {
  canvas.width = POSTCARD_WIDTH;
  canvas.height = POSTCARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  const sky = ctx.createLinearGradient(0, 0, 0, POSTCARD_HEIGHT);
  sky.addColorStop(0, '#0d1530');
  sky.addColorStop(1, '#2a2350');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, POSTCARD_WIDTH, POSTCARD_HEIGHT);
  // Stars, placed by a fixed pattern so every card is the same.
  ctx.fillStyle = 'rgba(243, 239, 216, 0.8)';
  for (let i = 0; i < 46; i++) {
    const sx = (i * 263) % POSTCARD_WIDTH;
    const sy = (i * 137) % 300;
    ctx.fillRect(sx, sy, i % 3 ? 2 : 3, i % 3 ? 2 : 3);
  }
  ctx.fillStyle = '#f3efd8';
  ctx.beginPath();
  ctx.arc(1080, 96, 44, 0, Math.PI * 2);
  ctx.fill();

  drawHouse(ctx, card, 30, 70, 1.55);
  // The hill the house stands on, running off the right edge of the card.
  ctx.fillStyle = '#070912';
  ctx.beginPath();
  ctx.moveTo(0, 535);
  ctx.quadraticCurveTo(170, 488, 330, 522);
  ctx.quadraticCurveTo(560, 566, 820, 540);
  ctx.quadraticCurveTo(1010, 520, POSTCARD_WIDTH, 548);
  ctx.lineTo(POSTCARD_WIDTH, POSTCARD_HEIGHT);
  ctx.lineTo(0, POSTCARD_HEIGHT);
  ctx.closePath();
  ctx.fill();
  // A bare tree on the hill.
  ctx.strokeStyle = '#070912';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(560, 552);
  ctx.lineTo(560, 452);
  ctx.moveTo(560, 490);
  ctx.lineTo(536, 462);
  ctx.moveTo(560, 476);
  ctx.lineTo(584, 444);
  ctx.moveTo(560, 512);
  ctx.lineTo(590, 494);
  ctx.stroke();

  // A brass frame, like the stage.
  ctx.strokeStyle = 'rgba(201, 162, 90, 0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, POSTCARD_WIDTH - 36, POSTCARD_HEIGHT - 36);

  const left = 640;
  const width = 500;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#e6b866';
  ctx.font = `22px ${DISPLAY}`;
  ctx.fillText('HAUNTED POMODORO', left, 110);
  ctx.fillStyle = '#d8ccb2';
  ctx.font = `italic 26px ${BODY}`;
  ctx.fillText(card.dateLine, left, 148);
  ctx.fillStyle = '#f6ecd6';
  ctx.font = `54px ${DISPLAY}`;
  let y = 222;
  // One number per line: "16 candles", then "8 comebacks".
  for (const line of card.headline.split(' · ').flatMap((part) => wrap(ctx, part, width))) {
    ctx.fillText(line, left, y);
    y += 58;
  }
  y += 4;
  ctx.fillStyle = '#d8ccb2';
  ctx.font = `28px ${BODY}`;
  for (const line of card.detail.split(' · ').flatMap((part) => wrap(ctx, part, width))) {
    ctx.fillText(line, left, y);
    y += 36;
  }
  y += 34;
  ctx.fillStyle = '#c9fbe8';
  ctx.font = `italic 32px ${BODY}`;
  for (const line of wrap(ctx, `“${card.ghostLine}”`, width)) {
    ctx.fillText(line, left, y);
    y += 40;
  }
  ctx.fillStyle = '#8ff5d2';
  ctx.font = `24px ${BODY}`;
  ctx.fillText('— Ottilie, the ghost of the house', left, y + 8);
}

/** Draws the card and saves it as a PNG through a temporary download link. */
export async function savePostcard(card: Postcard): Promise<void> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  paintPostcard(canvas, card);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The postcard could not be drawn');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = card.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
