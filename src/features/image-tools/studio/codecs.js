// Output formats for Image Studio. Every encoder is a Squoosh codec (via @jsquash) running in a worker.
// `fields` drive the settings UI; `toOptions` maps them to the codec's own option names.

export const FORMATS = {
  webp: {
    label: 'WebP', mime: 'image/webp', ext: 'webp',
    fields: [
      { key: 'quality', label: 'Quality', min: 0, max: 100, def: 75 },
      { key: 'lossless', label: 'Lossless', type: 'switch', def: false },
      { key: 'method', label: 'Effort', min: 0, max: 6, def: 4, hint: 'Higher = smaller, slower', advanced: true },
      { key: 'sharpYuv', label: 'Sharp RGB→YUV', type: 'switch', def: false, advanced: true },
      { key: 'alphaQuality', label: 'Alpha quality', min: 0, max: 100, def: 100, advanced: true },
    ],
    toOptions: (s) => ({
      quality: s.quality, method: s.method, lossless: s.lossless ? 1 : 0,
      use_sharp_yuv: s.sharpYuv ? 1 : 0, alpha_quality: s.alphaQuality, exact: s.lossless ? 1 : 0,
    }),
  },
  avif: {
    label: 'AVIF', mime: 'image/avif', ext: 'avif',
    fields: [
      { key: 'quality', label: 'Quality', min: 0, max: 100, def: 50 },
      { key: 'lossless', label: 'Lossless', type: 'switch', def: false },
      { key: 'speed', label: 'Speed', min: 0, max: 10, def: 6, hint: 'Lower = smaller, much slower', advanced: true },
      { key: 'subsample', label: 'Chroma', type: 'select', def: '1', advanced: true,
        opts: [{ value: '1', label: '4:2:0 (smallest)' }, { value: '2', label: '4:2:2' }, { value: '3', label: '4:4:4 (sharpest colour)' }] },
      { key: 'sharpness', label: 'Sharpness', min: 0, max: 7, def: 0, advanced: true },
    ],
    toOptions: (s) => ({ quality: s.quality, lossless: s.lossless, speed: s.speed, subsample: Number(s.subsample), sharpness: s.sharpness }),
  },
  jpeg: {
    label: 'MozJPEG', mime: 'image/jpeg', ext: 'jpg',
    fields: [
      { key: 'quality', label: 'Quality', min: 0, max: 100, def: 75 },
      { key: 'progressive', label: 'Progressive', type: 'switch', def: true },
      { key: 'chroma', label: 'Chroma subsample', type: 'select', def: '2', advanced: true,
        opts: [{ value: '2', label: '4:2:0 (smaller)' }, { value: '1', label: '4:4:4 (sharper)' }] },
      { key: 'smoothing', label: 'Smoothing', min: 0, max: 100, def: 0, advanced: true },
      { key: 'trellis', label: 'Trellis multipass', type: 'switch', def: false, advanced: true },
    ],
    toOptions: (s) => ({
      quality: s.quality, progressive: s.progressive, chroma_subsample: Number(s.chroma),
      auto_subsample: false, smoothing: s.smoothing, trellis_multipass: s.trellis,
    }),
    opaque: true,
  },
  png: {
    label: 'PNG (OxiPNG)', mime: 'image/png', ext: 'png',
    fields: [
      { key: 'level', label: 'Effort', min: 0, max: 6, def: 2, hint: 'Lossless — higher = smaller, slower' },
      { key: 'reduce', label: 'Reduce colours', type: 'switch', def: false, hint: 'Quantise to a palette (lossy, much smaller)' },
      { key: 'colors', label: 'Colours', min: 2, max: 256, def: 128, advanced: true },
      { key: 'interlace', label: 'Interlace', type: 'switch', def: false, advanced: true },
    ],
    toOptions: (s) => ({ level: s.level, interlace: s.interlace, optimiseAlpha: true, reduce: s.reduce ? s.colors : 0 }),
    lossless: true,
  },
  original: {
    label: 'Lossless PNG (no compression pass)', mime: 'image/png', ext: 'png', fields: [], toOptions: () => ({}),
  },
};

export const RESIZE_METHODS = [
  { value: 'lanczos3', label: 'Lanczos3 (sharp)' },
  { value: 'mitchell', label: 'Mitchell' },
  { value: 'catrom', label: 'Catmull-Rom' },
  { value: 'triangle', label: 'Triangle (smooth)' },
  { value: 'magicKernelSharp2021', label: 'Magic Kernel Sharp' },
  { value: 'hqx', label: 'hqx (pixel art, upscale)' },
];

export const defaultsFor = (fmt) => Object.fromEntries((FORMATS[fmt]?.fields || []).map((f) => [f.key, f.def]));

// Which formats the browser can *display* (AVIF everywhere modern; probe once).
export async function canDisplay(mime) {
  if (mime !== 'image/avif') return true;
  return new Promise((r) => {
    const i = new Image();
    i.onload = () => r(true); i.onerror = () => r(false);
    i.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
  });
}
