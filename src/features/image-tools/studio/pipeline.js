// Non-destructive edit pipeline. The source bitmap never changes; every render re-applies the edit list:
// orient (rotate/flip/straighten) → crop → adjustments → watermark. Resizing + encoding happen in the worker.

export const DEFAULT_ADJUST = {
  brightness: 100, contrast: 100, saturate: 100, hue: 0, warmth: 0,
  blur: 0, sharpen: 0, vignette: 0, grayscale: 0, sepia: 0, invert: 0,
};

export const DEFAULT_WATERMARK = {
  enabled: false, text: '© DevForge', size: 6, opacity: 45, color: '#ffffff', pos: 'br', tile: false, angle: -30,
};

export const DEFAULT_EDIT = {
  rotate: 0, flipH: false, flipV: false, straighten: 0,
  crop: null, // {x,y,w,h} in oriented-image pixels
  adjust: DEFAULT_ADJUST,
  watermark: DEFAULT_WATERMARK,
  resize: { enabled: false, w: 0, h: 0, lock: true, method: 'lanczos3' },
};

export const FILTER_PRESETS = {
  None: {},
  Vivid: { contrast: 115, saturate: 140 },
  Punch: { contrast: 130, saturate: 120, vignette: 25 },
  Mono: { grayscale: 100, contrast: 110 },
  Noir: { grayscale: 100, contrast: 150, brightness: 90, vignette: 40 },
  Vintage: { sepia: 45, contrast: 90, saturate: 85, warmth: 20, vignette: 30 },
  Warm: { warmth: 35, saturate: 110 },
  Cool: { warmth: -35, saturate: 105 },
  Fade: { contrast: 80, brightness: 110, saturate: 80 },
};

const isDefaultAdjust = (a) => Object.keys(DEFAULT_ADJUST).every((k) => a[k] === DEFAULT_ADJUST[k]);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

/** Size of the image after rotate (90° steps). Straighten keeps the size (it zooms in to hide corners). */
export function orientedSize(src, edit) {
  const swap = edit.rotate % 180 !== 0;
  return { w: swap ? src.height : src.width, h: swap ? src.width : src.height };
}

/** Final pre-resize size (after crop). */
export function editedSize(src, edit) {
  const o = orientedSize(src, edit);
  return edit.crop ? { w: edit.crop.w, h: edit.crop.h } : o;
}

function drawOriented(src, edit, scale) {
  const { w, h } = orientedSize(src, edit);
  const c = canvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(c.width / 2, c.height / 2);
  if (edit.straighten) {
    const t = (Math.abs(edit.straighten) * Math.PI) / 180;
    // Zoom so the rotated image still covers the whole frame (no transparent corners).
    const zoom = Math.max((w * Math.cos(t) + h * Math.sin(t)) / w, (w * Math.sin(t) + h * Math.cos(t)) / h);
    ctx.rotate((edit.straighten * Math.PI) / 180);
    ctx.scale(zoom, zoom);
  }
  ctx.rotate((edit.rotate * Math.PI) / 180);
  ctx.scale(edit.flipH ? -1 : 1, edit.flipV ? -1 : 1);
  ctx.drawImage(src, (-src.width * scale) / 2, (-src.height * scale) / 2, src.width * scale, src.height * scale);
  return c;
}

const supportsCtxFilter = (() => {
  if (typeof document === 'undefined') return false;
  try { return typeof document.createElement('canvas').getContext('2d').filter === 'string'; } catch { return false; }
})();

function cssFilter(a, scale) {
  const f = [];
  if (a.brightness !== 100) f.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) f.push(`contrast(${a.contrast}%)`);
  if (a.saturate !== 100) f.push(`saturate(${a.saturate}%)`);
  if (a.hue) f.push(`hue-rotate(${a.hue}deg)`);
  if (a.grayscale) f.push(`grayscale(${a.grayscale}%)`);
  if (a.sepia) f.push(`sepia(${a.sepia}%)`);
  if (a.invert) f.push(`invert(${a.invert}%)`);
  if (a.blur) f.push(`blur(${(a.blur * scale).toFixed(2)}px)`);
  return f.join(' ') || 'none';
}

// Pixel fallback for browsers without ctx.filter (older Safari). Blur is skipped there.
function manualAdjust(ctx, w, h, a) {
  const id = ctx.getImageData(0, 0, w, h); const d = id.data;
  const br = a.brightness / 100, ct = a.contrast / 100, sat = a.saturate / 100;
  const gs = a.grayscale / 100, sp = a.sepia / 100, inv = a.invert / 100;
  const hr = (a.hue * Math.PI) / 180, cosH = Math.cos(hr), sinH = Math.sin(hr);
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * br, g = d[i + 1] * br, b = d[i + 2] * br;
    r = (r - 128) * ct + 128; g = (g - 128) * ct + 128; b = (b - 128) * ct + 128;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    if (a.hue) {
      const nr = r * (0.213 + cosH * 0.787 - sinH * 0.213) + g * (0.715 - cosH * 0.715 - sinH * 0.715) + b * (0.072 - cosH * 0.072 + sinH * 0.928);
      const ng = r * (0.213 - cosH * 0.213 + sinH * 0.143) + g * (0.715 + cosH * 0.285 + sinH * 0.14) + b * (0.072 - cosH * 0.072 - sinH * 0.283);
      const nb = r * (0.213 - cosH * 0.213 - sinH * 0.787) + g * (0.715 - cosH * 0.715 + sinH * 0.715) + b * (0.072 + cosH * 0.928 + sinH * 0.072);
      r = nr; g = ng; b = nb;
    }
    if (gs) { const m = 0.2126 * r + 0.7152 * g + 0.0722 * b; r += (m - r) * gs; g += (m - g) * gs; b += (m - b) * gs; }
    if (sp) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b;
      r += (sr - r) * sp; g += (sg - g) * sp; b += (sb - b) * sp;
    }
    if (inv) { r += (255 - 2 * r) * inv; g += (255 - 2 * g) * inv; b += (255 - 2 * b) * inv; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b; // Uint8ClampedArray clamps for us
  }
  ctx.putImageData(id, 0, 0);
}

function sharpen(ctx, w, h, amount) {
  const id = ctx.getImageData(0, 0, w, h); const s = id.data; const out = new Uint8ClampedArray(s);
  const k = amount / 100; // blend of a 3×3 sharpen kernel
  const row = w * 4;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const o = y * row + x * 4;
      for (let c = 0; c < 3; c++) {
        const v = 5 * s[o + c] - s[o + c - 4] - s[o + c + 4] - s[o + c - row] - s[o + c + row];
        out[o + c] = s[o + c] + (v - s[o + c]) * k;
      }
    }
  }
  id.data.set(out); ctx.putImageData(id, 0, 0);
}

function applyAdjust(c, a, scale) {
  if (isDefaultAdjust(a)) return c;
  const out = canvas(c.width, c.height);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (supportsCtxFilter) { ctx.filter = cssFilter(a, scale); ctx.drawImage(c, 0, 0); ctx.filter = 'none'; }
  else { ctx.drawImage(c, 0, 0); manualAdjust(ctx, out.width, out.height, a); }
  if (a.warmth) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = a.warmth > 0 ? `rgba(255,140,40,${a.warmth / 100})` : `rgba(40,120,255,${-a.warmth / 100})`;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (a.sharpen) sharpen(ctx, out.width, out.height, a.sharpen);
  if (a.vignette) {
    const r = Math.hypot(out.width, out.height) / 2;
    const g = ctx.createRadialGradient(out.width / 2, out.height / 2, r * 0.45, out.width / 2, out.height / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a.vignette / 100})`);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = g; ctx.fillRect(0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return out;
}

const WM_POS = {
  tl: [0, 0], tc: [0.5, 0], tr: [1, 0], ml: [0, 0.5], mc: [0.5, 0.5], mr: [1, 0.5], bl: [0, 1], bc: [0.5, 1], br: [1, 1],
};

function applyWatermark(c, wm) {
  if (!wm.enabled || !wm.text.trim()) return c;
  const ctx = c.getContext('2d');
  const size = Math.max(8, (wm.size / 100) * c.width);
  ctx.save();
  ctx.globalAlpha = wm.opacity / 100;
  ctx.fillStyle = wm.color;
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = size / 8;
  const tw = ctx.measureText(wm.text).width;
  if (wm.tile) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const gx = tw + size * 3, gy = size * 4, diag = Math.hypot(c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((wm.angle * Math.PI) / 180);
    for (let y = -diag / 2; y < diag / 2; y += gy) {
      for (let x = -diag / 2; x < diag / 2; x += gx) ctx.fillText(wm.text, x + ((y / gy) % 2 ? gx / 2 : 0), y);
    }
  } else {
    const [px, py] = WM_POS[wm.pos] || WM_POS.br;
    const pad = size * 0.8;
    ctx.textBaseline = 'middle';
    const x = pad + px * (c.width - tw - pad * 2);
    const y = pad + size / 2 + py * (c.height - size - pad * 2);
    ctx.fillText(wm.text, x, y);
  }
  ctx.restore();
  return c;
}

/**
 * Render the edit pipeline. `maxSide` downsamples for fast on-screen previews; pass 0 for full resolution.
 * `skipCrop` returns the oriented + adjusted image (used while the crop tool is open).
 */
export function render(src, edit, { maxSide = 0, skipCrop = false } = {}) {
  const o = orientedSize(src, edit);
  const scale = maxSide ? Math.min(1, maxSide / Math.max(o.w, o.h)) : 1;
  let c = drawOriented(src, edit, scale);
  if (edit.crop && !skipCrop) {
    const { x, y, w, h } = edit.crop;
    const cc = canvas(w * scale, h * scale);
    cc.getContext('2d').drawImage(c, x * scale, y * scale, w * scale, h * scale, 0, 0, cc.width, cc.height);
    c = cc;
  }
  c = applyAdjust(c, edit.adjust, scale);
  if (!skipCrop) c = applyWatermark(c, edit.watermark);
  return c;
}

export const toImageData = (c) => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);

/** Output size after crop + optional resize. */
export function outputSize(src, edit) {
  const e = editedSize(src, edit);
  return edit.resize.enabled && edit.resize.w > 0 && edit.resize.h > 0 ? { w: edit.resize.w, h: edit.resize.h } : e;
}
