// Draws the Gupta Hardware mark and writes every asset the app ships.
// Run with `npm run brand`. Checked in so the icon can be changed by editing
// numbers here rather than by opening a design tool nobody has.
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

// The shop sells tiles, marble and granite. The mark is four tiles with the
// last one not yet laid — a grid reads as "tiles" at 48 pixels, and the gap
// stops it reading as a generic app-drawer icon.
const GREEN = [29, 158, 117];
const WHITE = [255, 255, 255];
const SAMPLES = 4;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

function insideRoundedRect(px, py, x, y, size, radius) {
  if (px < x || py < y || px > x + size || py > y + size) return false;
  const dx = Math.max(x + radius - px, 0, px - (x + size - radius));
  const dy = Math.max(y + radius - py, 0, py - (y + size - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/** The four tile squares, as a fraction of the canvas. */
function tiles(canvas, markFraction) {
  const mark = canvas * markFraction;
  const gap = mark * 0.12;
  const size = (mark - gap) / 2;
  const left = (canvas - mark) / 2;
  const top = (canvas - mark) / 2;
  const radius = size * 0.2;

  return [
    { x: left, y: top, size, radius, laid: true },
    { x: left + size + gap, y: top, size, radius, laid: true },
    { x: left, y: top + size + gap, size, radius, laid: true },
    { x: left + size + gap, y: top + size + gap, size, radius, laid: false },
  ];
}

function markCoverage(px, py, shapes) {
  for (const tile of shapes) {
    if (tile.laid) {
      if (insideRoundedRect(px, py, tile.x, tile.y, tile.size, tile.radius)) return true;
      continue;
    }
    // The tile still to be laid is an outline, so the mark is not a solid block.
    const stroke = tile.size * 0.1;
    const outer = insideRoundedRect(px, py, tile.x, tile.y, tile.size, tile.radius);
    const inner = insideRoundedRect(
      px,
      py,
      tile.x + stroke,
      tile.y + stroke,
      tile.size - stroke * 2,
      Math.max(tile.radius - stroke, 0),
    );
    if (outer && !inner) return true;
  }
  return false;
}

function render({ size, background, foreground, markFraction, cornerFraction = 0 }) {
  const png = new PNG({ width: size, height: size });
  const shapes = tiles(size, markFraction);
  const step = 1 / SAMPLES;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let markHits = 0;
      let bgHits = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;

          const withinPlate =
            !background || cornerFraction === 0
              ? true
              : insideRoundedRect(px, py, 0, 0, size, size * cornerFraction);
          if (withinPlate) bgHits += 1;
          if (markHits < SAMPLES * SAMPLES && markCoverage(px, py, shapes)) markHits += 1;
        }
      }

      const total = SAMPLES * SAMPLES;
      const markAlpha = clamp01(markHits / total);
      const bgAlpha = background ? clamp01(bgHits / total) : 0;

      // Mark over background, both premultiplied out to straight alpha.
      const outAlpha = markAlpha + bgAlpha * (1 - markAlpha);
      const idx = (size * y + x) << 2;

      for (let c = 0; c < 3; c += 1) {
        const value =
          outAlpha === 0
            ? 0
            : (foreground[c] * markAlpha + (background ? background[c] : 0) * bgAlpha * (1 - markAlpha)) /
              outAlpha;
        png.data[idx + c] = Math.round(value);
      }
      png.data[idx + 3] = Math.round(outAlpha * 255);
    }
  }

  return png;
}

function write(png, name) {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(join(OUT, name));
    stream.on('finish', () => resolve(name));
    stream.on('error', reject);
    png.pack().pipe(stream);
  });
}

const assets = [
  // The square icon, used where the platform does not mask it itself.
  { name: 'icon.png', size: 1024, background: GREEN, foreground: WHITE, markFraction: 0.52 },
  // Android draws these two through its own mask. The foreground has to stay
  // inside the middle two thirds or the mask will clip it.
  {
    name: 'android-icon-foreground.png',
    size: 1024,
    background: null,
    foreground: WHITE,
    markFraction: 0.42,
  },
  { name: 'android-icon-background.png', size: 1024, background: GREEN, foreground: GREEN, markFraction: 0 },
  {
    name: 'android-icon-monochrome.png',
    size: 1024,
    background: null,
    foreground: WHITE,
    markFraction: 0.42,
  },
  // Sits on the splash background, so it is the mark alone.
  { name: 'splash-icon.png', size: 1024, background: null, foreground: WHITE, markFraction: 0.6 },
  { name: 'favicon.png', size: 64, background: GREEN, foreground: WHITE, markFraction: 0.56 },
];

await mkdir(OUT, { recursive: true });
for (const asset of assets) {
  const png = render(asset);
  await write(png, asset.name);
  console.log(`wrote ${asset.name} (${asset.size}px)`);
}
