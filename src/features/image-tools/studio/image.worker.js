/* eslint-disable no-restricted-globals */
// Off-main-thread image pipeline: Squoosh resize → (optional palette reduction) → Squoosh encoder.
// Messages: { id, imageData, resize: {width,height,method}|null, format, options }
// Replies:  { id, buffer, width, height, ms } | { id, error }

const encoders = {
  webp: async (img, o) => (await import('@jsquash/webp/encode.js')).default(img, o),
  avif: async (img, o) => (await import('@jsquash/avif/encode.js')).default(img, o),
  jpeg: async (img, o) => (await import('@jsquash/jpeg/encode.js')).default(img, o),
  png: async (img, o) => {
    const { reduce, ...rest } = o;
    const src = reduce ? quantize(img, reduce) : img;
    return (await import('@jsquash/oxipng/optimise.js')).default(src, rest);
  },
  original: async (img) => (await import('@jsquash/png/encode.js')).default(img),
};

/** Median-cut palette reduction with Floyd–Steinberg dithering (PNG "reduce colours"). */
function quantize(img, colors) {
  const { data, width, height } = img;
  const n = width * height;
  // Sample at most ~100k pixels to build the palette.
  const step = Math.max(1, Math.floor(n / 100000));
  const samples = [];
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    samples.push([data[o], data[o + 1], data[o + 2], data[o + 3]]);
  }
  let boxes = [samples];
  while (boxes.length < colors) {
    let bi = -1, bestRange = -1, bestCh = 0;
    boxes.forEach((b, idx) => {
      if (b.length < 2) return;
      for (let c = 0; c < 4; c++) {
        let lo = 255, hi = 0;
        for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        if (hi - lo > bestRange) { bestRange = hi - lo; bi = idx; bestCh = c; }
      }
    });
    if (bi < 0 || bestRange <= 0) break;
    const b = boxes[bi].sort((p, q) => p[bestCh] - q[bestCh]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  const palette = boxes.map((b) => {
    const s = [0, 0, 0, 0];
    for (const p of b) for (let c = 0; c < 4; c++) s[c] += p[c];
    return s.map((v) => Math.round(v / b.length));
  });
  const cache = new Map();
  const nearest = (r, g, b, a) => {
    const key = ((r >> 2) << 18) | ((g >> 2) << 12) | ((b >> 2) << 6) | (a >> 2);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let best = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2 + (p[3] - a) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    cache.set(key, best);
    return best;
  };
  const out = new Uint8ClampedArray(data.length);
  const err = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const v = [0, 1, 2, 3].map((c) => Math.max(0, Math.min(255, data[o + c] + err[o + c])));
      const p = palette[nearest(v[0] | 0, v[1] | 0, v[2] | 0, v[3] | 0)];
      for (let c = 0; c < 4; c++) {
        out[o + c] = p[c];
        const e = v[c] - p[c];
        if (x + 1 < width) err[o + 4 + c] += (e * 7) / 16;
        if (y + 1 < height) {
          const d = o + width * 4;
          if (x > 0) err[d - 4 + c] += (e * 3) / 16;
          err[d + c] += (e * 5) / 16;
          if (x + 1 < width) err[d + 4 + c] += e / 16;
        }
      }
    }
  }
  return new ImageData(out, width, height);
}

self.onmessage = async ({ data: msg }) => {
  const { id, format, options = {}, resize } = msg;
  const t0 = performance.now();
  try {
    let img = msg.imageData;
    if (resize && (resize.width !== img.width || resize.height !== img.height)) {
      const { default: doResize } = await import('@jsquash/resize');
      img = await doResize(img, { width: resize.width, height: resize.height, method: resize.method || 'lanczos3', fitMethod: 'stretch', premultiply: true, linearRGB: true });
    }
    const enc = encoders[format];
    if (!enc) throw new Error(`Unknown format ${format}`);
    const buffer = await enc(img, options);
    self.postMessage({ id, buffer, width: img.width, height: img.height, ms: Math.round(performance.now() - t0) }, [buffer]);
  } catch (e) {
    self.postMessage({ id, error: e?.message || String(e) });
  }
};
