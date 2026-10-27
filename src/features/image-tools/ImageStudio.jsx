import { useState, useCallback, useRef, useEffect } from 'react';
import { downloadBlob } from '@/shared/lib/download';
import {
  Stack,
  Group,
  Button,
  Paper,
  Text,
  Slider,
  Select,
  NumberInput,
  Switch,
  Badge,
  Tabs,
  TextInput,
  ColorInput,
  Progress,
  Box,
  Center,
  ActionIcon,
  Tooltip,
  Modal,
  Divider,
  Loader,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconPhoto,
  IconDownload,
  IconRefresh,
  IconTrash,
  IconCrop,
  IconRotate,
  IconAdjustments,
  IconTypography,
  IconEraser,
  IconArrowsMaximize,
  IconUpload,
  IconX,
  IconLink,
  IconCheck,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconMaximize,
  IconMinimize,
  IconPlayerPlay,
} from '@tabler/icons-react';
import ToolHeader from '@/shared/components/ToolHeader';
import ViewToggle from '@/shared/components/ViewToggle';
import { useViewStore } from '@/shared/stores/view.store';

/* ───────────────────────── helpers ───────────────────────── */

function formatBytes(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const u = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(u); resolve(img); };
    img.onerror = reject;
    img.src = u;
  });
}

function imgToData(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function canvasBlob(canvas, type, quality) {
  return new Promise((r) => canvas.toBlob(r, type, quality));
}

/* ───────────────────── squoosh codec encode ───────────────────── */

async function codecEncode(imageData, format, s) {
  try {
    let blob;
    if (format === 'image/jpeg') {
      const { encode } = await import('@jsquash/jpeg');
      const buf = await encode(imageData, { quality: s.quality ?? 75, progressive: s.progressive ?? false });
      blob = new Blob([buf], { type: 'image/jpeg' });
    } else if (format === 'image/png') {
      const { encode } = await import('@jsquash/png');
      const buf = await encode(imageData, { effort: s.effort ?? 7 });
      blob = new Blob([buf], { type: 'image/png' });
    } else if (format === 'image/webp') {
      const { encode } = await import('@jsquash/webp');
      const buf = await encode(imageData, { quality: s.quality ?? 75, method: s.effort ?? 4 });
      blob = new Blob([buf], { type: 'image/webp' });
    } else if (format === 'image/avif') {
      const { encode } = await import('@jsquash/avif');
      const cqLevel = Math.round(63 - ((s.quality ?? 63) / 100) * 63);
      const buf = await encode(imageData, { cqLevel, speed: s.effort ?? 4, chromaSubsampling: s.chromaSubsampling ?? '4:2:0' });
      blob = new Blob([buf], { type: 'image/avif' });
    }
    if (blob) return blob;
  } catch (e) {
    console.warn('Codec fallback:', e.message);
  }
  // canvas fallback (no avif support)
  if (format === 'image/avif') throw new Error('AVIF encoding requires @jsquash/avif');
  return canvasBlob(
    (() => { const c = document.createElement('canvas'); c.width = imageData.width; c.height = imageData.height; c.getContext('2d').putImageData(imageData, 0, 0); return c; })(),
    format,
    (s.quality ?? 75) / 100,
  );
}

/* ───────────────────── codec settings definitions ───────────────────── */

const CODECS = {
  'image/jpeg': {
    label: 'JPEG (mozjpeg)',
    ext: 'jpg',
    fields: {
      quality: { label: 'Quality', min: 1, max: 100, def: 75 },
      progressive: { label: 'Progressive', type: 'switch', def: false },
    },
  },
  'image/png': {
    label: 'PNG (oxipng)',
    ext: 'png',
    fields: {
      effort: { label: 'Effort', min: 1, max: 10, def: 7, desc: 'Higher = slower, smaller' },
    },
  },
  'image/webp': {
    label: 'WebP',
    ext: 'webp',
    fields: {
      quality: { label: 'Quality', min: 1, max: 100, def: 75 },
      effort: { label: 'Effort', min: 0, max: 6, def: 4 },
    },
  },
  'image/avif': {
    label: 'AVIF',
    ext: 'avif',
    fields: {
      quality: { label: 'Quality', min: 1, max: 100, def: 63 },
      effort: { label: 'Speed', min: 0, max: 9, def: 4, desc: 'Lower = better quality, slower' },
      chromaSubsampling: { label: 'Chroma', type: 'select', def: '4:2:0', opts: [{ value: '4:2:0', label: '4:2:0 (smaller)' }, { value: '4:4:4', label: '4:4:4 (best)' }] },
    },
  },
};

function codecDefaults(fmt) {
  const c = CODECS[fmt];
  if (!c) return {};
  const d = {};
  Object.entries(c.fields).forEach(([k, v]) => { d[k] = v.def; });
  return d;
}

function CodecSettings({ format, settings, onChange }) {
  const codec = CODECS[format];
  if (!codec) return null;
  return (
    <Stack gap="sm">
      <Badge size="lg" variant="light">{codec.label} → .{codec.ext}</Badge>
      {Object.entries(codec.fields).map(([key, def]) => {
        const val = settings[key] ?? def.def;
        if (def.type === 'switch') return <Switch key={key} label={def.label} checked={val} onChange={(e) => onChange({ ...settings, [key]: e.currentTarget.checked })} />;
        if (def.type === 'select') return <Select key={key} label={def.label} value={val} onChange={(v) => onChange({ ...settings, [key]: v })} data={def.opts} size="sm" />;
        return (
          <Box key={key}>
            <Group justify="space-between" mb={2}>
              <Text size="sm">{def.label}: <strong>{val}</strong></Text>
              {def.desc && <Text size="xs" c="dimmed">{def.desc}</Text>}
            </Group>
            <Slider value={val} onChange={(v) => onChange({ ...settings, [key]: v })} min={def.min} max={def.max} />
          </Box>
        );
      })}
    </Stack>
  );
}

/* ───────────────────── MAIN COMPONENT ───────────────────── */

export default function ImageStudio() {
  // originals
  const [origFile, setOrigFile] = useState(null);
  const [origPreview, setOrigPreview] = useState(null);

  // working image (pipeline)
  const [workUrl, setWorkUrl] = useState(null);
  const [workBlob, setWorkBlob] = useState(null);
  const [workInfo, setWorkInfo] = useState(null); // { w, h, size }

  // output format tracked through pipeline
  const [outFmt, setOutFmt] = useState('image/png');

  // preview before commit
  const [preUrl, setPreUrl] = useState(null);
  const [preBlob, setPreBlob] = useState(null);
  const [preInfo, setPreInfo] = useState(null);

  // undo / redo
  const [undoStk, setUndoStk] = useState([]);
  const [redoStk, setRedoStk] = useState([]);

  // ui
  const [tab, setTab] = useState('compress');
  const [busy, setBusy] = useState(false);
  const [bgProg, setBgProg] = useState(0);
  const [bgErr, setBgErr] = useState(null);
  const [fsOpen, setFsOpen] = useState(false);
  const [fsSrc, setFsSrc] = useState(null);

  // view
  const { viewMode, setViewMode } = useViewStore();
  const horiz = viewMode === 'horizontal';

  // codec settings
  const [cSettings, setCSettings] = useState(codecDefaults('image/webp'));

  // tool settings
  const [resize, setResize] = useState({ w: 0, h: 0, lock: true });
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [cropDrag, setCropDrag] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [rot, setRot] = useState({ angle: 0, fh: false, fv: false });
  const [filt, setFilt] = useState({ brightness: 0, contrast: 0, saturation: 0, grayscale: false, sepia: false, invert: false });
  const [wm, setWm] = useState({ text: '© DevForge', size: 48, opacity: 50, pos: 'center', color: '#ffffff' });
  const [convFmt, setConvFmt] = useState('image/png');

  const imgElRef = useRef(null);

  /* ───── load file ───── */
  const loadFile = useCallback((file) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setOrigFile(file);
      setOrigPreview({ url, w: img.width, h: img.height, size: file.size, name: file.name });
      setWorkUrl(url);
      setWorkBlob(file);
      setWorkInfo({ w: img.width, h: img.height, size: file.size });
      setOutFmt('image/png');
      setResize({ w: img.width, h: img.height, lock: true });
      setCrop({ x: 0, y: 0, w: img.width, h: img.height });
      clearPre();
      setUndoStk([]); setRedoStk([]); setBgErr(null);
      setCSettings(codecDefaults('image/webp'));
    };
    img.src = url;
  }, []);

  const getWorkImg = useCallback(() => {
    if (!workUrl) return Promise.resolve(null);
    return new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = workUrl; });
  }, [workUrl]);

  const clearPre = useCallback(() => {
    if (preUrl) URL.revokeObjectURL(preUrl);
    setPreUrl(null); setPreBlob(null); setPreInfo(null);
  }, [preUrl]);

  const pushUndo = useCallback(() => {
    setUndoStk((p) => [...p, { url: workUrl, blob: workBlob, info: workInfo, fmt: outFmt }]);
    setRedoStk([]);
  }, [workUrl, workBlob, workInfo, outFmt]);

  const commitResult = useCallback((blob, w, h, fmt) => {
    const url = URL.createObjectURL(blob);
    setWorkUrl(url);
    setWorkBlob(blob);
    const info = { w, h, size: blob.size };
    setWorkInfo(info);
    setOutFmt(fmt || outFmt);
    setCrop({ x: 0, y: 0, w, h });
    setResize({ w, h, lock: true });
    clearPre();
  }, [outFmt, clearPre]);

  /* ───── preview (generates but does NOT commit) ───── */
  const genPreview = useCallback(async () => {
    if (!workUrl) return;
    setBusy(true); clearPre();
    try {
      const img = await getWorkImg();
      if (!img) { setBusy(false); return; }
      const w = img.width, h = img.height;

      if (tab === 'compress' || tab === 'convert') {
        const fmt = tab === 'compress' ? outFmt : convFmt;
        const s = tab === 'compress' ? cSettings : codecDefaults(fmt);
        const id = imgToData(img, w, h);
        const blob = await codecEncode(id, fmt, s);
        setPreUrl(URL.createObjectURL(blob));
        setPreBlob(blob);
        setPreInfo({ w, h, size: blob.size, format: fmt });
        setBusy(false);
        return;
      }

      if (tab === 'watermark') {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = wm.opacity / 100;
        ctx.fillStyle = wm.color;
        ctx.font = `bold ${wm.size}px Inter, sans-serif`;
        ctx.textBaseline = 'middle';
        const m = ctx.measureText(wm.text);
        const ps = {
          'center': [(w - m.width) / 2, h / 2],
          'top-left': [20, wm.size],
          'top-right': [w - m.width - 20, wm.size],
          'bottom-left': [20, h - wm.size],
          'bottom-right': [w - m.width - 20, h - wm.size],
          'tile': null,
        };
        if (wm.pos === 'tile') {
          const gx = m.width + 100, gy = wm.size * 4;
          for (let y = 0; y < h; y += gy) for (let x = 0; x < w; x += gx) {
            ctx.save(); ctx.translate(x + gx / 2, y + gy / 2); ctx.rotate(-Math.PI / 6);
            ctx.fillText(wm.text, -m.width / 2, 0); ctx.restore();
          }
        } else { ctx.fillText(wm.text, ...ps[wm.pos]); }
        const blob = await canvasBlob(c, 'image/png');
        setPreUrl(URL.createObjectURL(blob)); setPreBlob(blob);
        setPreInfo({ w, h, size: blob.size, format: 'image/png' });
      }

      if (tab === 'filters') {
        const id = imgToData(img, w, h);
        const d = id.data; const f = filt;
        for (let i = 0; i < d.length; i += 4) {
          let r = d[i], g = d[i + 1], b = d[i + 2];
          r += f.brightness * 2.55; g += f.brightness * 2.55; b += f.brightness * 2.55;
          const cf = (259 * (f.contrast + 255)) / (255 * (259 - f.contrast));
          r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128;
          const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
          const s = 1 + f.saturation / 100;
          r = gray + s * (r - gray); g = gray + s * (g - gray); b = gray + s * (b - gray);
          if (f.grayscale) { const a = 0.2989 * r + 0.587 * g + 0.114 * b; r = g = b = a; }
          if (f.sepia) { const sr = 0.393*r+0.769*g+0.189*b; const sg = 0.349*r+0.686*g+0.168*b; const sb = 0.272*r+0.534*g+0.131*b; r=sr;g=sg;b=sb; }
          if (f.invert) { r=255-r;g=255-g;b=255-b; }
          d[i] = Math.max(0,Math.min(255,r)); d[i+1] = Math.max(0,Math.min(255,g)); d[i+2] = Math.max(0,Math.min(255,b));
        }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').putImageData(id, 0, 0);
        const blob = await canvasBlob(c, 'image/png');
        setPreUrl(URL.createObjectURL(blob)); setPreBlob(blob);
        setPreInfo({ w, h, size: blob.size, format: 'image/png' });
      }

      setBusy(false);
    } catch (e) { console.error(e); setBusy(false); }
  }, [tab, workUrl, outFmt, cSettings, convFmt, filt, wm, getWorkImg, clearPre]);

  /* ───── apply non-realtime (resize, crop, rotate) ───── */
  const applyDirect = useCallback(async () => {
    if (!workUrl) return;
    setBusy(true);
    try {
      const img = await getWorkImg();
      if (!img) { setBusy(false); return; }
      const w = img.width, h = img.height;
      let c;

      if (tab === 'resize') {
        c = document.createElement('canvas');
        c.width = resize.w; c.height = resize.h;
        c.getContext('2d').drawImage(img, 0, 0, resize.w, resize.h);
      } else if (tab === 'crop') {
        if (crop.w < 1 || crop.h < 1) { setBusy(false); return; }
        c = document.createElement('canvas');
        c.width = crop.w; c.height = crop.h;
        c.getContext('2d').drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      } else if (tab === 'rotate') {
        const rad = (rot.angle * Math.PI) / 180;
        const ac = Math.abs(Math.cos(rad)), as = Math.abs(Math.sin(rad));
        const nw = Math.round(w * ac + h * as), nh = Math.round(w * as + h * ac);
        c = document.createElement('canvas'); c.width = nw; c.height = nh;
        const ctx = c.getContext('2d');
        ctx.translate(nw / 2, nh / 2); ctx.rotate(rad);
        if (rot.fh) ctx.scale(-1, 1); if (rot.fv) ctx.scale(1, -1);
        ctx.drawImage(img, -w / 2, -h / 2);
      }

      if (c) {
        const blob = await canvasBlob(c, 'image/png');
        pushUndo();
        commitResult(blob, c.width, c.height, 'image/png');
      }
      setBusy(false);
    } catch (e) { console.error(e); setBusy(false); }
  }, [tab, workUrl, resize, crop, rot, getWorkImg, pushUndo, commitResult]);

  /* ───── commit preview to working image ───── */
  const commitPreview = useCallback(() => {
    if (!preBlob || !preInfo) return;
    pushUndo();
    commitResult(preBlob, preInfo.w, preInfo.h, preInfo.format);
  }, [preBlob, preInfo, pushUndo, commitResult]);

  /* ───── bg remove ───── */
  const doBgRemove = useCallback(async () => {
    if (!workBlob) return;
    setBusy(true); setBgProg(0); setBgErr(null);
    try {
      const { removeBackground } = await import('@imgly/background-removal');
      // Run on the current working image so earlier crops/resizes are kept.
      const blob = await removeBackground(workBlob, {
        progress: (key, cur, tot) => { if (tot > 0) setBgProg(Math.round((cur / tot) * 100)); },
      });
      pushUndo();
      const img = await blobToImage(blob);
      commitResult(blob, img.width, img.height, 'image/png');
    } catch (e) { setBgErr(e.message || 'Failed'); }
    setBusy(false);
  }, [workBlob, pushUndo, commitResult]);

  /* ───── undo / redo ───── */
  const undo = useCallback(() => {
    if (!undoStk.length) return;
    const prev = undoStk[undoStk.length - 1];
    setUndoStk((s) => s.slice(0, -1));
    setRedoStk((s) => [...s, { url: workUrl, blob: workBlob, info: workInfo, fmt: outFmt }]);
    setWorkUrl(prev.url); setWorkBlob(prev.blob); setWorkInfo(prev.info); setOutFmt(prev.fmt || 'image/png');
    if (prev.info) { setCrop({ x:0, y:0, w:prev.info.w, h:prev.info.h }); setResize({ w:prev.info.w, h:prev.info.h, lock:true }); }
    clearPre();
  }, [undoStk, workUrl, workBlob, workInfo, outFmt, clearPre]);

  const redo = useCallback(() => {
    if (!redoStk.length) return;
    const next = redoStk[redoStk.length - 1];
    setRedoStk((s) => s.slice(0, -1));
    setUndoStk((s) => [...s, { url: workUrl, blob: workBlob, info: workInfo, fmt: outFmt }]);
    setWorkUrl(next.url); setWorkBlob(next.blob); setWorkInfo(next.info); setOutFmt(next.fmt || 'image/png');
    if (next.info) { setCrop({ x:0, y:0, w:next.info.w, h:next.info.h }); setResize({ w:next.info.w, h:next.info.h, lock:true }); }
    clearPre();
  }, [redoStk, workUrl, workBlob, workInfo, outFmt, clearPre]);

  /* ───── crop mouse ───── */
  const getPos = useCallback((e) => {
    const el = imgElRef.current;
    if (!el || !workInfo) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return { x: 0, y: 0 };
    return {
      x: Math.round(Math.max(0, Math.min(workInfo.w, ((e.clientX - r.left) / r.width) * workInfo.w))),
      y: Math.round(Math.max(0, Math.min(workInfo.h, ((e.clientY - r.top) / r.height) * workInfo.h))),
    };
  }, [workInfo]);

  const onCropDown = useCallback((e) => { const p = getPos(e); setCropStart(p); setCropDrag(true); setCrop({ x: p.x, y: p.y, w: 0, h: 0 }); }, [getPos]);
  const onCropMove = useCallback((e) => {
    if (!cropDrag || !cropStart) return;
    const p = getPos(e);
    const x = Math.max(0, Math.min(cropStart.x, p.x));
    const y = Math.max(0, Math.min(cropStart.y, p.y));
    setCrop({ x: Math.round(x), y: Math.round(y), w: Math.round(Math.abs(p.x - cropStart.x)), h: Math.round(Math.abs(p.y - cropStart.y)) });
  }, [cropDrag, cropStart, getPos]);
  const onCropUp = useCallback(() => setCropDrag(false), []);

  /* ───── format change ───── */
  const onFmtChange = useCallback((f) => { setOutFmt(f); setCSettings(codecDefaults(f)); }, []);

  /* ───── download ───── */
  const download = useCallback(() => {
    if (!workBlob) return;
    const ext = CODECS[outFmt]?.ext || outFmt.split('/')[1] || 'png';
    downloadBlob(workBlob, `devforge_${origPreview?.name?.replace(/\.[^.]+$/, '') || 'image'}.${ext}`);
  }, [workBlob, outFmt, origPreview]);

  /* ───── paste an image from the clipboard (Ctrl/Cmd+V) ───── */
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (!item || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const file = item.getAsFile();
      if (file) { e.preventDefault(); loadFile(new File([file], file.name || 'pasted.png', { type: file.type })); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  const reset = useCallback(() => {
    setOrigFile(null); setOrigPreview(null); setWorkUrl(null); setWorkBlob(null); setWorkInfo(null);
    setOutFmt('image/png'); clearPre(); setUndoStk([]); setRedoStk([]); setBgErr(null); setBgProg(0);
  }, [clearPre]);

  /* ───── derived ───── */
  const savings = origPreview && (preInfo || workInfo)
    ? Math.round((1 - ((preInfo || workInfo).size / origPreview.size)) * 100) : null;
  const displayUrl = preUrl || workUrl;
  const displayInfo = preInfo || workInfo;

  const toolTabs = [
    { v: 'compress', l: 'Compress', i: IconPhoto },
    { v: 'resize', l: 'Resize', i: IconArrowsMaximize },
    { v: 'crop', l: 'Crop', i: IconCrop },
    { v: 'rotate', l: 'Rotate/Flip', i: IconRotate },
    { v: 'filters', l: 'Filters', i: IconAdjustments },
    { v: 'convert', l: 'Convert', i: IconRefresh },
    { v: 'watermark', l: 'Watermark', i: IconTypography },
    { v: 'bgremove', l: 'BG Remove', i: IconEraser },
  ];

  /* ──────── RENDER ──────── */
  return (
    <Stack gap="md">
      {/* FULLSCREEN MODAL */}
      <Modal opened={fsOpen} onClose={() => setFsOpen(false)} fullScreen padding={0} withCloseButton={false}>
        <div style={{ position:'relative', width:'100%', height:'100vh', background:'#111', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <ActionIcon variant="filled" color="dark" size="lg" onClick={() => setFsOpen(false)}
            style={{ position:'absolute', top:16, right:16, zIndex:10 }}>
            <IconMinimize size={20} />
          </ActionIcon>
          <img src={fsSrc} style={{ maxWidth:'95vw', maxHeight:'95vh', objectFit:'contain' }} alt="fullscreen" />
        </div>
      </Modal>



      {/* DROP ZONE */}
      {!origFile ? (
        <Dropzone onDrop={(f) => f[0] && loadFile(f[0])} accept={{ 'image/*': [] }} maxSize={104857600} h={200}>
          <Group justify="center" gap="xl" mih={180} style={{ pointerEvents:'none' }}>
            <Dropzone.Accept><IconUpload size={48} color="var(--mantine-color-violet-5)" /></Dropzone.Accept>
            <Dropzone.Reject><IconX size={48} color="var(--mantine-color-red-5)" /></Dropzone.Reject>
            <Dropzone.Idle><IconPhoto size={48} /></Dropzone.Idle>
            <div>
              <Text size="lg" inline>Drop an image or click to browse</Text>
              <Text size="sm" c="dimmed" mt={4}>PNG, JPEG, WebP, AVIF, BMP, GIF — up to 100 MB · or paste with ⌘/Ctrl + V</Text>
            </div>
          </Group>
        </Dropzone>
      ) : (
        <div style={{ position:'relative' }}>
          {/* OVERLAY */}
          {busy && (
            <div style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(0,0,0,0.55)', borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', backdropFilter:'blur(3px)' }}>
              <Loader size="lg" color="violet" />
              <Text c="white" mt="md" fw={600}>
                {tab === 'bgremove' ? `Removing background... ${bgProg}%` : 'Processing...'}
              </Text>
              {tab === 'bgremove' && bgProg > 0 && <Progress value={bgProg} w={200} mt="sm" color="violet" striped animated />}
            </div>
          )}

          {/* PREVIEWS */}
          <div style={{ display:'flex', flexDirection: horiz ? 'row' : 'column', gap: 'var(--mantine-spacing-md)' }}>

            {/* WORKING */}
            <Paper withBorder p="sm" style={{ flex:1, minWidth:0 }}>
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={600} c="dimmed">Working Image</Text>
                <Group gap={4}>
                  {workInfo && <Badge size="sm">{workInfo.w} x {workInfo.h}</Badge>}
                  <Tooltip label="Fullscreen"><ActionIcon variant="subtle" size="sm" onClick={() => { setFsSrc(workUrl); setFsOpen(true); }}><IconMaximize size={14} /></ActionIcon></Tooltip>
                </Group>
              </Group>
              <div className="df-checker" style={{ borderRadius:8, overflow:'hidden', display:'flex', justifyContent:'center', alignItems:'center', minHeight:200 }}>
                {tab === 'crop' && workUrl ? (
                  <div style={{ display:'inline-block', position:'relative', cursor:'crosshair' }}
                    onMouseDown={onCropDown} onMouseMove={onCropMove} onMouseUp={onCropUp} onMouseLeave={onCropUp}>
                    <img ref={imgElRef} src={workUrl} style={{ display:'block', maxWidth:'100%', maxHeight:350, userSelect:'none' }} draggable={false} alt="working" />
                    {crop.w > 0 && crop.h > 0 && workInfo && (
                      <div style={{ position:'absolute', left:`${(crop.x / workInfo.w) * 100}%`, top:`${(crop.y / workInfo.h) * 100}%`, width:`${(crop.w / workInfo.w) * 100}%`, height:`${(crop.h / workInfo.h) * 100}%`, border:'2px dashed #8B5CF6', background:'rgba(139,92,246,0.15)', pointerEvents:'none' }} />
                    )}
                  </div>
                ) : workUrl ? (
                  <img src={workUrl} style={{ maxWidth:'100%', maxHeight:350, display:'block' }} alt="working" />
                ) : (
                  <Center h={200}><Text c="dimmed">No image</Text></Center>
                )}
              </div>
              {workInfo && (
                <Group mt={4} justify="center">
                  <Badge variant="light" color="blue">{formatBytes(workInfo.size)}</Badge>
                  <Badge variant="light">{origPreview?.name}</Badge>
                  <Badge variant="outline">{outFmt.split('/')[1]?.toUpperCase()}</Badge>
                </Group>
              )}
            </Paper>

            {/* PREVIEW / RESULT */}
            <Paper withBorder p="sm" style={{ flex:1, minWidth:0 }}>
              <Group justify="space-between" mb={4}>
                <Text size="xs" fw={600} c="dimmed">{preUrl ? 'Preview — click Commit to apply' : 'Result'}</Text>
                <Group gap={4}>
                  {displayInfo && <Badge size="sm">{displayInfo.w} x {displayInfo.h}</Badge>}
                  <Tooltip label="Fullscreen"><ActionIcon variant="subtle" size="sm" onClick={() => { setFsSrc(displayUrl || workUrl); setFsOpen(true); }}><IconMaximize size={14} /></ActionIcon></Tooltip>
                </Group>
              </Group>
              <div className="df-checker" style={{ borderRadius:8, overflow:'hidden', minHeight:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {displayUrl && displayUrl !== workUrl ? (
                  <img src={displayUrl} style={{ maxWidth:'100%', maxHeight:350, display:'block' }} alt="preview" />
                ) : (
                  <Text c="dimmed" size="sm">{busy ? 'Generating...' : 'Click Preview or Apply to see result'}</Text>
                )}
              </div>
              {displayInfo && (
                <Group mt={4} justify="center">
                  <Badge variant="light" color={savings > 0 ? 'green' : savings < 0 ? 'orange' : 'blue'}>
                    {formatBytes(displayInfo.size)} {savings != null && savings !== 0 ? `(${savings > 0 ? '↓' : '↑'}${Math.abs(savings)}%)` : ''}
                  </Badge>
                  {preUrl && <Badge variant="light" color="yellow">Preview</Badge>}
                  {displayInfo?.format && <Badge variant="outline">{displayInfo.format.split('/')[1]?.toUpperCase()}</Badge>}
                </Group>
              )}
            </Paper>
          </div>

          {/* TOOL TABS */}
          <Tabs value={tab} onChange={(v) => { setTab(v); clearPre(); }} keepMounted={false} mt="md">
            <Tabs.List grow>
              {toolTabs.map((t) => <Tabs.Tab key={t.v} value={t.v} leftSection={<t.i size={14} />}>{t.l}</Tabs.Tab>)}
            </Tabs.List>

            <Tabs.Panel value="compress" pt="md">
              <Paper withBorder p="md">
                <Group align="flex-start">
                  <Select label="Format" value={outFmt} onChange={onFmtChange} w={220}
                    data={Object.entries(CODECS).map(([v, c]) => ({ value: v, label: c.label }))} />
                  <Box style={{ flex:1 }}><CodecSettings format={outFmt} settings={cSettings} onChange={setCSettings} /></Box>
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="resize" pt="md">
              <Paper withBorder p="md">
                <Group>
                  <NumberInput label="Width" value={resize.w} onChange={(v) => setResize((p) => { const nw = v||0; return { ...p, w: nw, h: p.lock && workInfo ? Math.round(nw * (workInfo.h / workInfo.w)) : p.h }; })} min={1} max={10000} w={140} />
                  <Button variant="subtle" mt={24} px={4} onClick={() => setResize((p) => ({ ...p, lock: !p.lock }))} color={resize.lock ? 'violet' : 'gray'}>
                    <IconLink size={18} style={{ transform: resize.lock ? 'none' : 'rotate(45deg)' }} />
                  </Button>
                  <NumberInput label="Height" value={resize.h} onChange={(v) => setResize((p) => { const nh = v||0; return { ...p, w: p.lock && workInfo ? Math.round(nh * (workInfo.w / workInfo.h)) : p.w, h: nh }; })} min={1} max={10000} w={140} />
                  <Switch label="Lock" checked={resize.lock} onChange={(e) => setResize((p) => ({ ...p, lock: e.currentTarget.checked }))} mt={24} />
                  <Text size="xs" c="dimmed" mt={24}>Current: {workInfo?.w}x{workInfo?.h}</Text>
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="crop" pt="md">
              <Paper withBorder p="md">
                <Text size="sm" mb="xs">Drag on the working image, then click Apply</Text>
                <Group>
                  <Badge>X: {crop.x}</Badge><Badge>Y: {crop.y}</Badge><Badge>W: {crop.w}</Badge><Badge>H: {crop.h}</Badge>
                  <Button variant="subtle" size="compact-xs" onClick={() => workInfo && setCrop({ x:0, y:0, w:workInfo.w, h:workInfo.h })}>Select All</Button>
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="rotate" pt="md">
              <Paper withBorder p="md">
                <Text size="sm" mb={4}>Angle: {rot.angle}°</Text>
                <Slider value={rot.angle} onChange={(v) => setRot((p) => ({ ...p, angle: v }))} min={-180} max={180} marks={[{ value: -180, label: '-180' }, { value: -90 }, { value: 0, label: '0' }, { value: 90 }, { value: 180, label: '180' }]} />
                <Group mt="md">
                  <Switch label="Flip H" checked={rot.fh} onChange={(e) => setRot((p) => ({ ...p, fh: e.currentTarget.checked }))} />
                  <Switch label="Flip V" checked={rot.fv} onChange={(e) => setRot((p) => ({ ...p, fv: e.currentTarget.checked }))} />
                  <Button variant="subtle" size="compact-xs" onClick={() => setRot({ angle:0, fh:false, fv:false })}>Reset</Button>
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="filters" pt="md">
              <Paper withBorder p="md">
                <Group align="flex-start" grow>
                  <div>
                    <Text size="sm" mb={2}>Brightness: {filt.brightness}</Text>
                    <Slider value={filt.brightness} onChange={(v) => setFilt((p) => ({ ...p, brightness: v }))} min={-100} max={100} mb="sm" />
                    <Text size="sm" mb={2}>Contrast: {filt.contrast}</Text>
                    <Slider value={filt.contrast} onChange={(v) => setFilt((p) => ({ ...p, contrast: v }))} min={-100} max={100} mb="sm" />
                    <Text size="sm" mb={2}>Saturation: {filt.saturation}</Text>
                    <Slider value={filt.saturation} onChange={(v) => setFilt((p) => ({ ...p, saturation: v }))} min={-100} max={100} />
                  </div>
                  <div>
                    <Switch label="Grayscale" checked={filt.grayscale} onChange={(e) => setFilt((p) => ({ ...p, grayscale: e.currentTarget.checked }))} mb="sm" />
                    <Switch label="Sepia" checked={filt.sepia} onChange={(e) => setFilt((p) => ({ ...p, sepia: e.currentTarget.checked }))} mb="sm" />
                    <Switch label="Invert" checked={filt.invert} onChange={(e) => setFilt((p) => ({ ...p, invert: e.currentTarget.checked }))} mb="sm" />
                    <Button variant="subtle" size="compact-xs" onClick={() => setFilt({ brightness:0, contrast:0, saturation:0, grayscale:false, sepia:false, invert:false })}>Reset All</Button>
                  </div>
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="convert" pt="md">
              <Paper withBorder p="md">
                <Select label="Convert To" value={convFmt} onChange={setConvFmt} w={220}
                  data={Object.entries(CODECS).map(([v, c]) => ({ value: v, label: c.label }))} />
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="watermark" pt="md">
              <Paper withBorder p="md">
                <Group>
                  <TextInput label="Text" value={wm.text} onChange={(e) => setWm((p) => ({ ...p, text: e.currentTarget.value }))} style={{ flex:1 }} />
                  <NumberInput label="Size" value={wm.size} onChange={(v) => setWm((p) => ({ ...p, size: v||48 }))} min={8} max={500} w={100} />
                  <ColorInput label="Color" value={wm.color} onChange={(v) => setWm((p) => ({ ...p, color: v }))} w={140} />
                </Group>
                <Group mt="sm">
                  <Box style={{ flex:1 }}>
                    <Text size="sm" mb={2}>Opacity: {wm.opacity}%</Text>
                    <Slider value={wm.opacity} onChange={(v) => setWm((p) => ({ ...p, opacity: v }))} min={5} max={100} />
                  </Box>
                  <Select label="Position" value={wm.pos} onChange={(v) => setWm((p) => ({ ...p, pos: v }))}
                    data={[{ value:'center', label:'Center' },{ value:'top-left', label:'Top Left' },{ value:'top-right', label:'Top Right' },{ value:'bottom-left', label:'Bottom Left' },{ value:'bottom-right', label:'Bottom Right' },{ value:'tile', label:'Tile' }]} w={160} />
                </Group>
              </Paper>
            </Tabs.Panel>

            <Tabs.Panel value="bgremove" pt="md">
              <Paper withBorder p="md">
                <Text size="sm">Remove background using client-side AI. Model (~40 MB) downloads once and is cached. Processing may take 10-30 seconds.</Text>
                {bgErr && <Text c="red" size="sm" mt="xs">{bgErr}</Text>}
              </Paper>
            </Tabs.Panel>
          </Tabs>

          {/* ACTIONS */}
          <Group justify="center" mt="md" gap="sm">
            <Button variant="default" leftSection={<IconArrowBackUp size={16} />} onClick={undo} disabled={!undoStk.length || busy} size="sm">
              Undo ({undoStk.length})
            </Button>
            <Button variant="default" leftSection={<IconArrowForwardUp size={16} />} onClick={redo} disabled={!redoStk.length || busy} size="sm">
              Redo ({redoStk.length})
            </Button>

            <Divider orientation="vertical" />

            {/* Preview button (compress, convert, filters, watermark) */}
            {['compress', 'convert', 'filters', 'watermark'].includes(tab) && (
              <Button leftSection={<IconPlayerPlay size={16} />} onClick={genPreview} disabled={!workUrl || busy} loading={busy} size="md" color="violet">
                Preview {toolTabs.find((t) => t.v === tab)?.l}
              </Button>
            )}

            {/* Commit preview */}
            {preBlob && !busy && (
              <Button leftSection={<IconCheck size={16} />} onClick={commitPreview} size="md" color="teal">
                Commit
              </Button>
            )}

            {/* Direct apply (resize, crop, rotate) */}
            {['resize', 'crop', 'rotate'].includes(tab) && (
              <Button leftSection={<IconCheck size={16} />} onClick={applyDirect} disabled={!workUrl || busy} loading={busy} size="md" color="violet">
                Apply {toolTabs.find((t) => t.v === tab)?.l}
              </Button>
            )}

            {/* BG Remove */}
            {tab === 'bgremove' && (
              <Button leftSection={<IconEraser size={16} />} onClick={doBgRemove} disabled={!workBlob || busy} loading={busy} size="md" color="violet">
                Remove Background
              </Button>
            )}

            {workBlob && (
              <Button variant="light" leftSection={<IconDownload size={16} />} onClick={download} disabled={busy}>
                Download .{CODECS[outFmt]?.ext || 'png'}
              </Button>
            )}

            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={reset} disabled={busy}>
              New Image
            </Button>
          </Group>
        </div>
      )}
    </Stack>
  );
}