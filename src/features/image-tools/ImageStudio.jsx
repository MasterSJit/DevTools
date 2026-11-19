import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon, Badge, Button, ColorInput, Group, Loader, NumberInput, Paper, Progress, ScrollArea, SegmentedControl,
  Select, SimpleGrid, Slider, Stack, Switch, Text, TextInput, Tooltip, UnstyledButton, Alert,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import {
  IconPhoto, IconDownload, IconCrop, IconRotate, IconRotateClockwise, IconRotate2, IconFlipVertical, IconFlipHorizontal,
  IconAdjustments, IconTypography, IconEraser, IconArrowsMaximize, IconUpload, IconX, IconLink, IconLinkOff,
  IconArrowBackUp, IconArrowForwardUp, IconZoomIn, IconZoomOut, IconZoomReset, IconCheck,
  IconInfoCircle, IconSparkles, IconPhotoPlus, IconRefresh, IconChevronDown, IconMapPinExclamation, IconStack2,
} from '@tabler/icons-react';
import { downloadBlob, formatBytes } from '@/shared/lib/download';
import { FORMATS, RESIZE_METHODS, defaultsFor } from './studio/codecs';
import {
  DEFAULT_ADJUST, DEFAULT_EDIT, DEFAULT_WATERMARK, FILTER_PRESETS, editedSize, orientedSize, outputSize, render, toImageData,
} from './studio/pipeline';
import { encodeImage, Cancelled } from './studio/encoderClient';
import CropOverlay from './studio/CropOverlay';
import BatchPanel from './studio/BatchPanel';

const MAX_FILE = 100 * 1024 * 1024;
const MAX_PIXELS = 100e6; // guard against decompression bombs
const PREVIEW_SIDE = 2400;

const TOOLS = [
  { id: 'compress', label: 'Compress', icon: IconSparkles },
  { id: 'crop', label: 'Crop', icon: IconCrop },
  { id: 'rotate', label: 'Rotate', icon: IconRotate },
  { id: 'resize', label: 'Resize', icon: IconArrowsMaximize },
  { id: 'adjust', label: 'Adjust', icon: IconAdjustments },
  { id: 'watermark', label: 'Text', icon: IconTypography },
  { id: 'bg', label: 'Remove BG', icon: IconEraser },
  { id: 'info', label: 'Info', icon: IconInfoCircle },
];

const ASPECTS = [
  { label: 'Free', v: 0 }, { label: 'Original', v: -1 }, { label: '1:1', v: 1 }, { label: '4:3', v: 4 / 3 },
  { label: '3:2', v: 3 / 2 }, { label: '16:9', v: 16 / 9 }, { label: '4:5', v: 4 / 5 }, { label: '9:16', v: 9 / 16 },
];

/** Callback-ref size observer (works for elements that mount later, unlike a ref captured on first render). */
function useSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const obs = useRef(null);
  const node = useRef(null);
  const ref = useCallback((el) => {
    obs.current?.disconnect();
    node.current = el;
    if (!el) return;
    obs.current = new ResizeObserver(([e]) => setSize({ width: e.contentRect.width, height: e.contentRect.height }));
    obs.current.observe(el);
  }, []);
  useEffect(() => () => obs.current?.disconnect(), []);
  return { ref, node, ...size };
}

/* ───────────────────────── small UI pieces ───────────────────────── */

function Field({ label, value, unit = '', hint, children }) {
  return (
    <div>
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.4 }}>{label}</Text>
        {value !== undefined && <Text size="xs" ff="monospace" fw={600}>{value}{unit}</Text>}
      </Group>
      {children}
      {hint && <Text size="10px" c="dimmed" mt={3}>{hint}</Text>}
    </div>
  );
}

function SliderField({ label, value, onChange, min, max, step = 1, unit, hint, center }) {
  return (
    <Field label={label} value={value} unit={unit} hint={hint}>
      <Slider size="sm" value={value} onChange={onChange} min={min} max={max} step={step} label={null}
        onDoubleClick={() => center !== undefined && onChange(center)} />
    </Field>
  );
}

function sampleImage() {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1067;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#1e1b4b'); g.addColorStop(0.55, '#c026d3'); g.addColorStop(1, '#fb923c');
  x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(255,240,200,0.95)'; x.beginPath(); x.arc(1100, 520, 170, 0, Math.PI * 2); x.fill();
  const layers = [['#0f172a', 0.72, 0.006], ['#1e293b', 0.8, 0.004], ['#020617', 0.9, 0.009]];
  layers.forEach(([col, base, f], li) => {
    x.fillStyle = col; x.beginPath(); x.moveTo(0, c.height);
    for (let px = 0; px <= c.width; px += 8) x.lineTo(px, c.height * base - Math.sin(px * f + li) * 70 - Math.cos(px * f * 2.3) * 40);
    x.lineTo(c.width, c.height); x.fill();
  });
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; x.fillRect(Math.random() * c.width, Math.random() * 380, 2, 2); }
  return new Promise((r) => c.toBlob((b) => r(new File([b], 'sample-sunset.png', { type: 'image/png' })), 'image/png'));
}

/* ───────────────────────── main ───────────────────────── */

export default function ImageStudio() {
  const [mode, setMode] = useState('editor');

  // source
  const [file, setFile] = useState(null);
  const [src, setSrc] = useState(null); // ImageBitmap
  const [meta, setMeta] = useState(null);
  const [loadErr, setLoadErr] = useState(null);

  // edits + history (rapid changes within 600 ms are coalesced into one undo step)
  const [edit, setEdit] = useState(DEFAULT_EDIT);
  const hist = useRef({ past: [], future: [], last: 0 });
  const [, bump] = useState(0);

  const update = useCallback((fn) => {
    setEdit((cur) => {
      const next = typeof fn === 'function' ? fn(cur) : fn;
      if (next === cur) return cur;
      const h = hist.current; const now = Date.now();
      if (now - h.last > 600) { h.past.push({ edit: cur, src: null }); if (h.past.length > 60) h.past.shift(); }
      h.last = now; h.future = [];
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const setSrcWithHistory = useCallback((bmp) => {
    setSrc((cur) => { hist.current.past.push({ edit, src: cur }); hist.current.future = []; hist.current.last = 0; return bmp; });
    bump((n) => n + 1);
  }, [edit]);

  const undo = useCallback(() => {
    const h = hist.current; const prev = h.past.pop();
    if (!prev) return;
    h.future.push({ edit, src: prev.src ? src : null });
    if (prev.src) setSrc(prev.src);
    setEdit(prev.edit); h.last = 0; bump((n) => n + 1);
  }, [edit, src]);

  const redo = useCallback(() => {
    const h = hist.current; const next = h.future.pop();
    if (!next) return;
    h.past.push({ edit, src: next.src ? src : null });
    if (next.src) setSrc(next.src);
    setEdit(next.edit); h.last = 0; bump((n) => n + 1);
  }, [edit, src]);

  // ui
  const [tool, setTool] = useState('compress');
  const [fmt, setFmt] = useState('webp');
  const [settings, setSettings] = useState(defaultsFor('webp'));
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [compare, setCompare] = useState('split');
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(null); // null = fit
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // crop draft
  const [cropDraft, setCropDraft] = useState(null);
  const [aspect, setAspect] = useState(0);

  // output
  const [out, setOut] = useState(null);
  const [encoding, setEncoding] = useState(false);
  const [encErr, setEncErr] = useState(null);

  // bg removal
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProg, setBgProg] = useState(0);
  const [bgErr, setBgErr] = useState(null);

  const beforeRef = useRef(null);
  const { ref: stageRef, node: stageNode, width: stageW, height: stageH } = useSize();
  const { ref: rootRef, width: rootW } = useSize();
  const wide = rootW >= 920; // container-based layout (the app sidebar eats a lot of viewport width)

  /* ───── load ───── */
  const loadFile = useCallback(async (f) => {
    setLoadErr(null);
    if (!f || !f.type.startsWith('image/')) { setLoadErr('That is not an image file.'); return; }
    if (f.size > MAX_FILE) { setLoadErr(`File too large (${formatBytes(f.size)}). Max is 100 MB.`); return; }
    try {
      const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' });
      if (bmp.width * bmp.height > MAX_PIXELS) { bmp.close?.(); setLoadErr('Image is larger than 100 megapixels.'); return; }
      setFile(f); setSrc(bmp);
      setEdit({ ...DEFAULT_EDIT, resize: { ...DEFAULT_EDIT.resize, w: bmp.width, h: bmp.height } });
      hist.current = { past: [], future: [], last: 0 };
      setOut(null); setEncErr(null); setBgErr(null); setZoom(null); setPan({ x: 0, y: 0 }); setTool('compress'); setCropDraft(null);
      const m = { name: f.name, type: f.type || 'unknown', size: f.size, w: bmp.width, h: bmp.height, gps: null, camera: null };
      setMeta(m);
      // Privacy check: does the original carry GPS / camera info? (It's always stripped on export.)
      import('exifr').then(async (exifr) => {
        const [gps, tags] = await Promise.all([exifr.gps(f).catch(() => null), exifr.parse(f, ['Make', 'Model', 'DateTimeOriginal']).catch(() => null)]);
        setMeta((cur) => (cur?.name === f.name ? { ...cur, gps, camera: tags } : cur));
      }).catch(() => {});
    } catch {
      setLoadErr('This browser cannot decode that image format.');
    }
  }, []);

  useEffect(() => {
    const onPaste = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) { e.preventDefault(); setMode('editor'); loadFile(new File([f], f.name || 'pasted.png', { type: f.type })); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  const reset = () => {
    setFile(null); setSrc(null); setMeta(null); setOut(null); setEdit(DEFAULT_EDIT);
    hist.current = { past: [], future: [], last: 0 };
  };

  /* ───── geometry ───── */
  const cropping = tool === 'crop' && !!src;
  const natural = useMemo(() => {
    if (!src) return { w: 1, h: 1 };
    if (cropping) return orientedSize(src, edit);
    return outputSize(src, edit);
  }, [src, edit, cropping]);

  const fit = useMemo(() => {
    if (!stageW || !stageH) return 1;
    return Math.min((stageW - 48) / natural.w, (stageH - 48) / natural.h, 1);
  }, [stageW, stageH, natural]);
  const z = cropping ? fit : (zoom ?? fit);
  const dispW = Math.max(1, natural.w * z), dispH = Math.max(1, natural.h * z);

  /* ───── live "before" preview (fast, downsampled) ───── */
  useEffect(() => {
    if (!src || !beforeRef.current) return undefined;
    const raf = requestAnimationFrame(() => {
      const c = render(src, edit, { maxSide: PREVIEW_SIDE, skipCrop: cropping });
      const el = beforeRef.current; if (!el) return;
      el.width = c.width; el.height = c.height;
      el.getContext('2d').drawImage(c, 0, 0);
    });
    return () => cancelAnimationFrame(raf);
  }, [src, edit, cropping]);

  /* ───── encode (debounced, full resolution, in a worker) ───── */
  const encodeKey = useMemo(() => ({ src, edit, fmt, settings, bgColor }), [src, edit, fmt, settings, bgColor]);
  const [debouncedKey] = useDebouncedValue(encodeKey, 450);

  useEffect(() => {
    const { src: s, edit: e, fmt: f, settings: st, bgColor: bg } = debouncedKey;
    if (!s || cropping) return;
    let alive = true;
    (async () => {
      setEncoding(true); setEncErr(null);
      try {
        let c = render(s, e);
        if (FORMATS[f].opaque) { // JPEG has no alpha: flatten onto the chosen background
          const flat = document.createElement('canvas'); flat.width = c.width; flat.height = c.height;
          const fx = flat.getContext('2d'); fx.fillStyle = bg; fx.fillRect(0, 0, c.width, c.height); fx.drawImage(c, 0, 0); c = flat;
        }
        const size = outputSize(s, e);
        const r = await encodeImage(toImageData(c), {
          format: f, mime: FORMATS[f].mime, options: FORMATS[f].toOptions(st),
          resize: e.resize.enabled ? { width: size.w, height: size.h, method: e.resize.method } : null,
        });
        if (!alive) return;
        setOut((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return { ...r, url: URL.createObjectURL(r.blob), fmt: f }; });
        setEncoding(false);
      } catch (err) {
        if (err instanceof Cancelled || !alive) return;
        setEncErr(err.message); setEncoding(false);
      }
    })();
    return () => { alive = false; };
  }, [debouncedKey, cropping]);

  useEffect(() => () => { if (out?.url) URL.revokeObjectURL(out.url); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ───── crop tool ───── */
  const openTool = (id) => {
    if (id === 'crop' && src) {
      const o = orientedSize(src, edit);
      setCropDraft(edit.crop || { x: 0, y: 0, w: o.w, h: o.h });
    }
    setTool(id);
  };

  const applyAspect = (v) => {
    setAspect(v);
    if (!src || !v) return;
    const o = orientedSize(src, edit);
    const ratio = v === -1 ? src.width / src.height : v;
    let w = o.w, h = w / ratio;
    if (h > o.h) { h = o.h; w = h * ratio; }
    setCropDraft({ x: Math.round((o.w - w) / 2), y: Math.round((o.h - h) / 2), w: Math.round(w), h: Math.round(h) });
  };

  const applyCrop = () => {
    const o = orientedSize(src, edit);
    const full = cropDraft.x === 0 && cropDraft.y === 0 && cropDraft.w === o.w && cropDraft.h === o.h;
    update((e) => {
      const c = full ? null : cropDraft;
      const s = c ? { w: c.w, h: c.h } : o;
      return { ...e, crop: c, resize: { ...e.resize, w: s.w, h: s.h } };
    });
    setTool('compress');
  };

  // 90° rotations and flips transform the frame, so carry the crop rectangle along with it.
  const rotateBy = (deg) => update((e) => {
    const { w: W, h: H } = orientedSize(src, e);
    const rotate = (e.rotate + deg + 360) % 360;
    let crop = e.crop;
    if (crop) {
      crop = deg > 0
        ? { x: H - (crop.y + crop.h), y: crop.x, w: crop.h, h: crop.w }
        : { x: crop.y, y: W - (crop.x + crop.w), w: crop.h, h: crop.w };
    }
    const s = crop ? { w: crop.w, h: crop.h } : orientedSize(src, { ...e, rotate });
    return { ...e, rotate, crop, resize: { ...e.resize, w: e.resize.enabled ? e.resize.h : s.w, h: e.resize.enabled ? e.resize.w : s.h } };
  });

  // Flips happen in source space; in the rotated frame a source flip may be vertical.
  const flip = (axis) => update((e) => {
    const { w: W, h: H } = orientedSize(src, e);
    const frameAxis = e.rotate % 180 === 0 ? axis : axis === 'h' ? 'v' : 'h';
    let crop = e.crop;
    if (crop) crop = frameAxis === 'h' ? { ...crop, x: W - crop.x - crop.w } : { ...crop, y: H - crop.y - crop.h };
    return { ...e, crop, ...(axis === 'h' ? { flipH: !e.flipH } : { flipV: !e.flipV }) };
  });

  /* ───── zoom / pan ───── */
  const panRef = useRef(null);
  const onStageWheel = (e) => {
    if (!src || cropping || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom((cur) => Math.min(8, Math.max(0.05, (cur ?? fit) * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
  };
  useEffect(() => {
    const el = stageNode.current; if (!el) return undefined;
    el.addEventListener('wheel', onStageWheel, { passive: false });
    return () => el.removeEventListener('wheel', onStageWheel);
  });
  const onPanDown = (e) => {
    if (cropping || z <= fit + 0.001) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, p: pan };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPanMove = (e) => { const p = panRef.current; if (p) setPan({ x: p.p.x + e.clientX - p.sx, y: p.p.y + e.clientY - p.sy }); };
  const onPanUp = () => { panRef.current = null; };
  const setZoomTo = (v) => { setZoom(v); if (v === null) setPan({ x: 0, y: 0 }); };

  /* ───── split divider ───── */
  const splitRef = useRef(null);
  const onSplitDown = (e) => { e.stopPropagation(); splitRef.current = e.currentTarget.parentElement.getBoundingClientRect(); e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onSplitMove = (e) => { const r = splitRef.current; if (r) setSplit(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))); };
  const onSplitUp = () => { splitRef.current = null; };

  /* ───── background removal ───── */
  const removeBg = async () => {
    setBgBusy(true); setBgProg(0); setBgErr(null);
    try {
      const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      const png = await new Promise((r) => c.toBlob(r, 'image/png'));
      const { removeBackground } = await import('@imgly/background-removal');
      const blob = await removeBackground(png, { progress: (_k, cur, tot) => tot > 0 && setBgProg(Math.round((cur / tot) * 100)) });
      setSrcWithHistory(await createImageBitmap(blob));
      if (FORMATS[fmt].opaque) { setFmt('webp'); setSettings(defaultsFor('webp')); }
    } catch (e) { setBgErr(e.message || 'Background removal failed'); }
    setBgBusy(false);
  };

  /* ───── download ───── */
  const download = () => {
    if (!out) return;
    const base = (meta?.name || 'image').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').slice(0, 80);
    downloadBlob(out.blob, `${base}-devforge.${FORMATS[out.fmt].ext}`);
  };

  useHotkeys([
    ['mod+z', undo], ['mod+shift+z', redo], ['mod+y', redo],
    ['mod+s', (e) => { e?.preventDefault?.(); download(); }],
    ['Enter', () => cropping && cropDraft && applyCrop()],
    ['Escape', () => cropping && setTool('compress')],
  ]);

  const changeFmt = (f) => { setFmt(f); setSettings(defaultsFor(f)); };
  const setA = (k) => (v) => update((e) => ({ ...e, adjust: { ...e.adjust, [k]: v } }));
  const setW = (patch) => update((e) => ({ ...e, watermark: { ...e.watermark, ...patch } }));
  const setR = (patch) => update((e) => ({ ...e, resize: { ...e.resize, ...patch } }));

  const saving = out && meta ? Math.round((1 - out.blob.size / meta.size) * 100) : null;
  const edited = src ? editedSize(src, edit) : null;

  /* ═════════════════════════ RENDER ═════════════════════════ */

  if (mode === 'batch') {
    return (
      <Stack gap="md">
        <ModeSwitch mode={mode} setMode={setMode} />
        <BatchPanel />
      </Stack>
    );
  }

  if (!src) {
    return (
      <Stack gap="md">
        <ModeSwitch mode={mode} setMode={setMode} />
        <Dropzone onDrop={(f) => loadFile(f[0])} onReject={() => setLoadErr('Unsupported file or larger than 100 MB.')}
          accept={['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/bmp', 'image/svg+xml', 'image/x-icon']}
          maxSize={MAX_FILE} multiple={false} radius="xl"
          styles={{ root: { borderWidth: 2, background: 'linear-gradient(135deg, var(--mantine-color-violet-light), transparent 60%)' } }}>
          <Stack align="center" gap="md" py={56} style={{ pointerEvents: 'none' }}>
            <div className="w-20 h-20 rounded-3xl grid place-items-center" style={{ background: 'var(--mantine-color-violet-filled)', boxShadow: '0 12px 40px -8px var(--mantine-color-violet-filled)' }}>
              <Dropzone.Accept><IconUpload size={40} color="white" /></Dropzone.Accept>
              <Dropzone.Reject><IconX size={40} color="white" /></Dropzone.Reject>
              <Dropzone.Idle><IconPhotoPlus size={40} color="white" /></Dropzone.Idle>
            </div>
            <div className="text-center">
              <Text fz={22} fw={700}>Drop an image to start editing</Text>
              <Text c="dimmed" size="sm" mt={4}>or click to browse · paste with ⌘/Ctrl + V · PNG, JPEG, WebP, AVIF, GIF, BMP, SVG</Text>
            </div>
            <Group gap={6} justify="center" maw={560}>
              {['MozJPEG', 'WebP', 'AVIF', 'OxiPNG', 'Lanczos resize', 'Crop', 'Rotate & straighten', 'Filters', 'Watermark', 'AI background removal'].map((t) => (
                <Badge key={t} variant="light" color="violet" radius="sm" tt="none">{t}</Badge>
              ))}
            </Group>
          </Stack>
        </Dropzone>
        <Group justify="center">
          <Button variant="subtle" leftSection={<IconPhoto size={16} />} onClick={async () => loadFile(await sampleImage())}>Try a sample image</Button>
        </Group>
        {loadErr && <Alert color="red" variant="light" icon={<IconX size={16} />}>{loadErr}</Alert>}
        <Text size="xs" c="dimmed" ta="center">Powered by Google Squoosh codecs compiled to WebAssembly. Images never leave your device.</Text>
      </Stack>
    );
  }

  const fmtDef = FORMATS[fmt];
  const visibleFields = fmtDef.fields.filter((f) => !f.advanced || showAdvanced);

  return (
    <Stack gap="sm" ref={rootRef}>
      {/* ── top bar ── */}
      <Paper p={8} radius="lg" withBorder>
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
            <ModeSwitch mode={mode} setMode={setMode} compact />
            <Text size="sm" fw={600} truncate maw={220} title={meta?.name}>{meta?.name}</Text>
            <Badge variant="default" radius="sm">{meta?.w}×{meta?.h}</Badge>
          </Group>
          <Group gap={4} wrap="wrap">
            <Tooltip label="Undo (⌘Z)"><ActionIcon variant="subtle" size="lg" onClick={undo} disabled={!hist.current.past.length}><IconArrowBackUp size={18} /></ActionIcon></Tooltip>
            <Tooltip label="Redo (⌘⇧Z)"><ActionIcon variant="subtle" size="lg" onClick={redo} disabled={!hist.current.future.length}><IconArrowForwardUp size={18} /></ActionIcon></Tooltip>
            <div className="w-px h-6 mx-1" style={{ background: 'var(--mantine-color-default-border)' }} />
            <SegmentedControl size="xs" value={compare} onChange={setCompare} disabled={cropping}
              data={[{ value: 'split', label: 'Split' }, { value: 'before', label: 'Before' }, { value: 'after', label: 'After' }]} />
            <div className="w-px h-6 mx-1" style={{ background: 'var(--mantine-color-default-border)' }} />
            <Tooltip label="Zoom out"><ActionIcon variant="subtle" size="lg" disabled={cropping} onClick={() => setZoomTo(Math.max(0.05, z / 1.25))}><IconZoomOut size={18} /></ActionIcon></Tooltip>
            <UnstyledButton onClick={() => setZoomTo(zoom === 1 ? null : 1)} disabled={cropping} className="px-1">
              <Text size="xs" ff="monospace" w={44} ta="center">{Math.round(z * 100)}%</Text>
            </UnstyledButton>
            <Tooltip label="Zoom in (⌘ + scroll)"><ActionIcon variant="subtle" size="lg" disabled={cropping} onClick={() => setZoomTo(Math.min(8, z * 1.25))}><IconZoomIn size={18} /></ActionIcon></Tooltip>
            <Tooltip label="Fit"><ActionIcon variant="subtle" size="lg" disabled={cropping} onClick={() => setZoomTo(null)}><IconZoomReset size={18} /></ActionIcon></Tooltip>
          </Group>
          <Group gap={6} wrap="nowrap">
            <Button variant="default" size="xs" leftSection={<IconPhotoPlus size={14} />} onClick={reset}>New</Button>
            <Button size="xs" color="violet" leftSection={<IconDownload size={14} />} onClick={download} disabled={!out || encoding || cropping}>
              Download {out ? `· ${formatBytes(out.blob.size)}` : ''}
            </Button>
          </Group>
        </Group>
      </Paper>

      <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', gap: 12 }}>
        {/* ── stage ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div ref={stageRef} onPointerDown={onPanDown} onPointerMove={onPanMove} onPointerUp={onPanUp} onPointerCancel={onPanUp}
            className="relative overflow-hidden rounded-2xl"
            style={{
              height: wide ? 'clamp(380px, calc(100vh - 250px), 900px)' : 'clamp(300px, 55vh, 560px)', background: 'radial-gradient(ellipse at center, #1c1c26 0%, #0b0b10 100%)',
              cursor: !cropping && z > fit + 0.001 ? (panRef.current ? 'grabbing' : 'grab') : 'default',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
            <div className="absolute left-1/2 top-1/2" style={{ width: dispW, height: dispH, transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))` }}>
              <div className="df-checker absolute inset-0 rounded-sm" style={{ boxShadow: '0 20px 60px -10px rgba(0,0,0,0.8)' }} />
              {/* before */}
              <canvas ref={beforeRef} className="absolute inset-0" style={{
                width: dispW, height: dispH, imageRendering: z > 2 ? 'pixelated' : 'auto',
                visibility: cropping || compare !== 'after' || !out ? 'visible' : 'hidden',
              }} />
              {/* after */}
              {!cropping && out && compare !== 'before' && (
                <img src={out.url} alt="Compressed result" draggable={false} className="absolute inset-0 select-none"
                  style={{ width: dispW, height: dispH, imageRendering: z > 2 ? 'pixelated' : 'auto', clipPath: compare === 'split' ? `inset(0 0 0 ${split}%)` : 'none' }} />
              )}
              {!cropping && out && compare === 'split' && (
                <div className="absolute top-0 bottom-0 z-10" style={{ left: `${split}%`, width: 0 }}>
                  <div className="absolute top-0 bottom-0" style={{ left: -1, width: 2, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 8px rgba(0,0,0,0.6)' }} />
                  <div onPointerDown={onSplitDown} onPointerMove={onSplitMove} onPointerUp={onSplitUp} role="slider" aria-label="Compare divider" aria-valuenow={Math.round(split)} tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(0, s - 5)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(100, s + 5)); }}
                    className="absolute top-1/2 grid place-items-center rounded-full"
                    style={{ left: -18, width: 36, height: 36, marginTop: -18, background: '#fff', cursor: 'ew-resize', boxShadow: '0 2px 12px rgba(0,0,0,0.5)', touchAction: 'none' }}>
                    <Text size="xs" fw={800} c="dark">‹ ›</Text>
                  </div>
                </div>
              )}
              {cropping && cropDraft && (
                <CropOverlay imgW={natural.w} imgH={natural.h} displayW={dispW} displayH={dispH} rect={cropDraft} onChange={setCropDraft}
                  aspect={aspect === -1 ? src.width / src.height : aspect || null} />
              )}
            </div>

            {/* corner labels */}
            {!cropping && compare === 'split' && out && (
              <>
                <Badge className="absolute top-3 left-3" variant="filled" color="dark" radius="sm">Before · {meta && formatBytes(meta.size)}</Badge>
                <Badge className="absolute top-3 right-3" variant="filled" color="violet" radius="sm">After · {fmtDef.label}</Badge>
              </>
            )}
            {(encoding || bgBusy) && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                <Loader size={14} color="violet" />
                <Text size="xs" c="white">{bgBusy ? `Removing background ${bgProg}%` : `Encoding ${fmtDef.label}…`}</Text>
              </div>
            )}
          </div>

          {/* ── stats bar ── */}
          <Paper p="xs" radius="lg" withBorder>
            <Group justify="space-between" wrap="wrap" gap="xs">
              <Group gap="lg" wrap="wrap">
                <div><Text size="10px" c="dimmed" tt="uppercase" fw={700}>Original</Text><Text size="sm" fw={600}>{formatBytes(meta.size)} <Text span c="dimmed" size="xs">{meta.type.replace('image/', '').toUpperCase()} · {meta.w}×{meta.h}</Text></Text></div>
                <Text c="dimmed">→</Text>
                <div>
                  <Text size="10px" c="dimmed" tt="uppercase" fw={700}>Output</Text>
                  {out ? (
                    <Text size="sm" fw={600}>{formatBytes(out.blob.size)} <Text span c="dimmed" size="xs">{FORMATS[out.fmt].ext.toUpperCase()} · {out.width}×{out.height} · {out.ms} ms</Text></Text>
                  ) : <Text size="sm" c="dimmed">{cropping ? 'Paused while cropping' : 'Encoding…'}</Text>}
                </div>
              </Group>
              {saving !== null && (
                <Badge size="lg" radius="sm" variant="light" color={saving > 0 ? 'teal' : 'orange'}>
                  {saving > 0 ? `−${saving}% smaller` : `+${-saving}% larger`}
                </Badge>
              )}
            </Group>
            {saving !== null && <Progress value={Math.max(2, Math.min(100, 100 - saving))} color={saving > 0 ? 'teal' : 'orange'} size={4} mt={6} radius="xl" />}
          </Paper>
          {encErr && <Alert color="red" variant="light" p="xs">Encoder error: {encErr}</Alert>}
        </div>

        {/* ── sidebar ── */}
        <Paper radius="lg" withBorder style={{ width: wide ? 372 : '100%', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', height: '100%' }}>
          {/* tool rail */}
          <div style={{ display: 'flex', flexDirection: wide ? 'column' : 'row', gap: 4, padding: 6, overflowX: 'auto', flexShrink: 0, borderRight: wide ? '1px solid var(--mantine-color-default-border)' : 'none', borderBottom: wide ? 'none' : '1px solid var(--mantine-color-default-border)', background: 'var(--mantine-color-default-hover)' }}>
            {TOOLS.map((t) => {
              const active = tool === t.id;
              return (
                <Tooltip key={t.id} label={t.label} position={wide ? 'left' : 'top'} withArrow disabled>
                  <UnstyledButton onClick={() => openTool(t.id)} aria-label={t.label} aria-pressed={active}
                    className="flex flex-col items-center justify-center gap-0.5 rounded-lg shrink-0 transition-colors"
                    style={{ width: 56, height: 52, background: active ? 'var(--mantine-color-violet-filled)' : 'transparent', color: active ? '#fff' : undefined }}>
                    <t.icon size={19} stroke={1.7} />
                    <span style={{ fontSize: 9.5, fontWeight: 600 }}>{t.label}</span>
                  </UnstyledButton>
                </Tooltip>
              );
            })}
          </div>

          {/* panel */}
          <ScrollArea.Autosize mah={wide ? 'clamp(380px, calc(100vh - 160px), 990px)' : undefined} style={{ flex: 1, minWidth: 0 }} type="auto">
            <Stack gap="md" p="md">
              {tool === 'compress' && (
                <>
                  <Text fw={700}>Output format</Text>
                  <SimpleGrid cols={2} spacing={6}>
                    {Object.entries(FORMATS).filter(([k]) => k !== 'original').map(([k, f]) => (
                      <UnstyledButton key={k} onClick={() => changeFmt(k)} className="rounded-lg px-3 py-2 transition-colors"
                        style={{ border: `1.5px solid ${fmt === k ? 'var(--mantine-color-violet-filled)' : 'var(--mantine-color-default-border)'}`, background: fmt === k ? 'var(--mantine-color-violet-light)' : 'transparent' }}>
                        <Text size="sm" fw={700}>{f.label}</Text>
                        <Text size="10px" c="dimmed">.{f.ext}{f.lossless ? ' · lossless' : ''}{f.opaque ? ' · no alpha' : ''}</Text>
                      </UnstyledButton>
                    ))}
                  </SimpleGrid>
                  {visibleFields.map((f) => {
                    const v = settings[f.key];
                    const set = (val) => setSettings((s) => ({ ...s, [f.key]: val }));
                    if (f.type === 'switch') return <Switch key={f.key} label={f.label} description={f.hint} checked={!!v} onChange={(e) => set(e.currentTarget.checked)} color="violet" />;
                    if (f.type === 'select') return <Select key={f.key} label={f.label} data={f.opts} value={v} onChange={set} allowDeselect={false} size="xs" />;
                    if (f.key === 'quality' && settings.lossless) return null;
                    if (f.key === 'colors' && !settings.reduce) return null;
                    return <SliderField key={f.key} label={f.label} value={v} onChange={set} min={f.min} max={f.max} hint={f.hint} />;
                  })}
                  {fmtDef.fields.some((f) => f.advanced) && (
                    <UnstyledButton onClick={() => setShowAdvanced((s) => !s)}>
                      <Group gap={4}><IconChevronDown size={14} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} /><Text size="xs" fw={600} c="violet">{showAdvanced ? 'Hide' : 'Show'} advanced settings</Text></Group>
                    </UnstyledButton>
                  )}
                  {fmtDef.opaque && <ColorInput label="Background for transparent areas" size="xs" value={bgColor} onChange={setBgColor} />}
                  <Alert variant="light" color="gray" p="xs" icon={<IconInfoCircle size={14} />}>
                    <Text size="xs">Tip: drag the divider on the image to compare. Metadata (GPS, camera) is removed on export.</Text>
                  </Alert>
                </>
              )}

              {tool === 'crop' && cropDraft && (
                <>
                  <Text fw={700}>Crop</Text>
                  <Field label="Aspect ratio">
                    <SimpleGrid cols={4} spacing={4}>
                      {ASPECTS.map((a) => (
                        <Button key={a.label} size="compact-xs" variant={aspect === a.v ? 'filled' : 'default'} color="violet" onClick={() => applyAspect(a.v)}>{a.label}</Button>
                      ))}
                    </SimpleGrid>
                  </Field>
                  <SimpleGrid cols={2} spacing="xs">
                    {['x', 'y', 'w', 'h'].map((k) => (
                      <NumberInput key={k} size="xs" label={{ x: 'X', y: 'Y', w: 'Width', h: 'Height' }[k]} value={cropDraft[k]} min={0} hideControls
                        onChange={(v) => setCropDraft((d) => ({ ...d, [k]: Math.max(k === 'w' || k === 'h' ? 8 : 0, Number(v) || 0) }))} />
                    ))}
                  </SimpleGrid>
                  <Text size="xs" c="dimmed">Drag the box or its handles. Arrow keys nudge (Shift = 10 px). Enter applies, Esc cancels.</Text>
                  <Group grow>
                    <Button variant="default" size="xs" onClick={() => { const o = orientedSize(src, edit); setCropDraft({ x: 0, y: 0, w: o.w, h: o.h }); setAspect(0); }}>Reset</Button>
                    <Button color="violet" size="xs" leftSection={<IconCheck size={14} />} onClick={applyCrop}>Apply crop</Button>
                  </Group>
                </>
              )}

              {tool === 'rotate' && (
                <>
                  <Text fw={700}>Rotate & flip</Text>
                  <SimpleGrid cols={4} spacing={6}>
                    <Tooltip label="Rotate left"><Button variant="default" onClick={() => rotateBy(-90)}><IconRotate2 size={18} /></Button></Tooltip>
                    <Tooltip label="Rotate right"><Button variant="default" onClick={() => rotateBy(90)}><IconRotateClockwise size={18} /></Button></Tooltip>
                    <Tooltip label="Flip horizontal"><Button variant={edit.flipH ? 'light' : 'default'} color="violet" onClick={() => flip('h')}><IconFlipVertical size={18} /></Button></Tooltip>
                    <Tooltip label="Flip vertical"><Button variant={edit.flipV ? 'light' : 'default'} color="violet" onClick={() => flip('v')}><IconFlipHorizontal size={18} /></Button></Tooltip>
                  </SimpleGrid>
                  <SliderField label="Straighten" value={edit.straighten} unit="°" min={-45} max={45} step={0.5} center={0}
                    onChange={(v) => update((e) => ({ ...e, straighten: v }))} hint="Auto-zooms to hide corners. Double-click to reset." />
                  <Text size="xs" c="dimmed">Rotation: {edit.rotate}° {edit.flipH && '· flipped H'} {edit.flipV && '· flipped V'}</Text>
                  <Button variant="subtle" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => update((e) => ({ ...e, rotate: 0, flipH: false, flipV: false, straighten: 0, crop: null }))}>Reset orientation</Button>
                </>
              )}

              {tool === 'resize' && edited && (
                <>
                  <Group justify="space-between"><Text fw={700}>Resize</Text><Switch checked={edit.resize.enabled} color="violet" onChange={(e) => setR({ enabled: e.currentTarget.checked })} /></Group>
                  <Group gap={6} align="flex-end" wrap="nowrap" style={{ opacity: edit.resize.enabled ? 1 : 0.5 }}>
                    <NumberInput size="xs" label="Width" value={edit.resize.w} min={1} max={16384} disabled={!edit.resize.enabled}
                      onChange={(v) => { const w = Math.max(1, Number(v) || 1); setR({ w, h: edit.resize.lock ? Math.max(1, Math.round(w * edited.h / edited.w)) : edit.resize.h }); }} />
                    <ActionIcon variant={edit.resize.lock ? 'light' : 'subtle'} color="violet" size="lg" mb={1} disabled={!edit.resize.enabled} onClick={() => setR({ lock: !edit.resize.lock })} aria-label="Lock aspect ratio">
                      {edit.resize.lock ? <IconLink size={16} /> : <IconLinkOff size={16} />}
                    </ActionIcon>
                    <NumberInput size="xs" label="Height" value={edit.resize.h} min={1} max={16384} disabled={!edit.resize.enabled}
                      onChange={(v) => { const h = Math.max(1, Number(v) || 1); setR({ h, w: edit.resize.lock ? Math.max(1, Math.round(h * edited.w / edited.h)) : edit.resize.w }); }} />
                  </Group>
                  <Field label="Presets">
                    <SimpleGrid cols={4} spacing={4}>
                      {[25, 50, 75].map((p) => (
                        <Button key={p} size="compact-xs" variant="default" disabled={!edit.resize.enabled}
                          onClick={() => setR({ w: Math.max(1, Math.round(edited.w * p / 100)), h: Math.max(1, Math.round(edited.h * p / 100)) })}>{p}%</Button>
                      ))}
                      {[3840, 2560, 1920, 1280, 1080, 800, 512].map((w) => (
                        <Button key={w} size="compact-xs" variant="default" disabled={!edit.resize.enabled}
                          onClick={() => setR({ w, h: Math.max(1, Math.round(w * edited.h / edited.w)) })}>{w}w</Button>
                      ))}
                    </SimpleGrid>
                  </Field>
                  <Select size="xs" label="Resampling (Squoosh)" data={RESIZE_METHODS} value={edit.resize.method} allowDeselect={false} disabled={!edit.resize.enabled} onChange={(v) => setR({ method: v })} />
                  <Text size="xs" c="dimmed">Source after crop: {edited.w}×{edited.h}</Text>
                </>
              )}

              {tool === 'adjust' && (
                <>
                  <Group justify="space-between"><Text fw={700}>Adjust</Text>
                    <Button size="compact-xs" variant="subtle" onClick={() => update((e) => ({ ...e, adjust: DEFAULT_ADJUST }))}>Reset</Button>
                  </Group>
                  <Field label="Presets">
                    <SimpleGrid cols={3} spacing={4}>
                      {Object.entries(FILTER_PRESETS).map(([name, p]) => (
                        <Button key={name} size="compact-xs" variant="default" onClick={() => update((e) => ({ ...e, adjust: { ...DEFAULT_ADJUST, ...p } }))}>{name}</Button>
                      ))}
                    </SimpleGrid>
                  </Field>
                  <SliderField label="Brightness" value={edit.adjust.brightness} unit="%" min={0} max={200} center={100} onChange={setA('brightness')} />
                  <SliderField label="Contrast" value={edit.adjust.contrast} unit="%" min={0} max={200} center={100} onChange={setA('contrast')} />
                  <SliderField label="Saturation" value={edit.adjust.saturate} unit="%" min={0} max={300} center={100} onChange={setA('saturate')} />
                  <SliderField label="Warmth" value={edit.adjust.warmth} min={-100} max={100} center={0} onChange={setA('warmth')} />
                  <SliderField label="Hue" value={edit.adjust.hue} unit="°" min={-180} max={180} center={0} onChange={setA('hue')} />
                  <SliderField label="Sharpen" value={edit.adjust.sharpen} min={0} max={100} center={0} onChange={setA('sharpen')} />
                  <SliderField label="Blur" value={edit.adjust.blur} unit="px" min={0} max={40} step={0.5} center={0} onChange={setA('blur')} />
                  <SliderField label="Vignette" value={edit.adjust.vignette} min={0} max={100} center={0} onChange={setA('vignette')} />
                  <SliderField label="Grayscale" value={edit.adjust.grayscale} unit="%" min={0} max={100} center={0} onChange={setA('grayscale')} />
                  <SliderField label="Sepia" value={edit.adjust.sepia} unit="%" min={0} max={100} center={0} onChange={setA('sepia')} />
                  <SliderField label="Invert" value={edit.adjust.invert} unit="%" min={0} max={100} center={0} onChange={setA('invert')} />
                  <Text size="10px" c="dimmed">Double-click a slider to reset it.</Text>
                </>
              )}

              {tool === 'watermark' && (
                <>
                  <Group justify="space-between"><Text fw={700}>Text watermark</Text><Switch color="violet" checked={edit.watermark.enabled} onChange={(e) => setW({ enabled: e.currentTarget.checked })} /></Group>
                  <TextInput size="xs" label="Text" value={edit.watermark.text} maxLength={120} onChange={(e) => setW({ text: e.currentTarget.value, enabled: true })} />
                  <SliderField label="Size" value={edit.watermark.size} unit="% width" min={1} max={30} step={0.5} onChange={(v) => setW({ size: v })} />
                  <SliderField label="Opacity" value={edit.watermark.opacity} unit="%" min={5} max={100} onChange={(v) => setW({ opacity: v })} />
                  <ColorInput size="xs" label="Colour" value={edit.watermark.color} onChange={(v) => setW({ color: v })} swatches={['#ffffff', '#000000', '#7c3aed', '#ef4444', '#facc15']} />
                  <Switch size="sm" label="Tile across the image" checked={edit.watermark.tile} onChange={(e) => setW({ tile: e.currentTarget.checked })} color="violet" />
                  {edit.watermark.tile ? (
                    <SliderField label="Angle" value={edit.watermark.angle} unit="°" min={-90} max={90} onChange={(v) => setW({ angle: v })} />
                  ) : (
                    <Field label="Position">
                      <div className="grid grid-cols-3 gap-1 w-[120px]">
                        {['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'].map((p) => (
                          <UnstyledButton key={p} onClick={() => setW({ pos: p })} aria-label={`Position ${p}`} className="h-8 rounded-md"
                            style={{ background: edit.watermark.pos === p ? 'var(--mantine-color-violet-filled)' : 'var(--mantine-color-default-hover)' }} />
                        ))}
                      </div>
                    </Field>
                  )}
                  <Button size="compact-xs" variant="subtle" onClick={() => setW({ ...DEFAULT_WATERMARK })}>Reset</Button>
                </>
              )}

              {tool === 'bg' && (
                <>
                  <Text fw={700}>AI background removal</Text>
                  <Text size="sm" c="dimmed">Runs an on-device segmentation model (~40 MB, downloaded once and cached). Your image is not uploaded.</Text>
                  <Button color="violet" leftSection={<IconEraser size={16} />} loading={bgBusy} onClick={removeBg}>Remove background</Button>
                  {bgBusy && <Progress value={bgProg} striped animated color="violet" />}
                  {bgErr && <Alert color="red" variant="light" p="xs">{bgErr}</Alert>}
                  <Text size="xs" c="dimmed">Output switches to WebP if JPEG was selected, so transparency is kept. Undo restores the original.</Text>
                </>
              )}

              {tool === 'info' && meta && (
                <>
                  <Text fw={700}>Image info</Text>
                  {[
                    ['File', meta.name], ['Type', meta.type], ['Size', formatBytes(meta.size)], ['Dimensions', `${meta.w} × ${meta.h}`],
                    ['Megapixels', (meta.w * meta.h / 1e6).toFixed(2)],
                    meta.camera?.Make && ['Camera', `${meta.camera.Make} ${meta.camera.Model || ''}`],
                    meta.camera?.DateTimeOriginal && ['Taken', String(meta.camera.DateTimeOriginal)],
                    out && ['Output', `${out.width} × ${out.height} · ${formatBytes(out.blob.size)}`],
                  ].filter(Boolean).map(([k, v]) => (
                    <Group key={k} justify="space-between" wrap="nowrap" gap="xs"><Text size="xs" c="dimmed">{k}</Text><Text size="xs" fw={600} ta="right" style={{ wordBreak: 'break-all' }}>{v}</Text></Group>
                  ))}
                  {meta.gps ? (
                    <Alert color="orange" variant="light" p="xs" icon={<IconMapPinExclamation size={16} />}>
                      <Text size="xs">The original contains a GPS location ({meta.gps.latitude?.toFixed(4)}, {meta.gps.longitude?.toFixed(4)}). It is removed from the exported file.</Text>
                    </Alert>
                  ) : <Alert color="teal" variant="light" p="xs"><Text size="xs">No GPS location found. All metadata is stripped on export anyway.</Text></Alert>}
                </>
              )}
            </Stack>
          </ScrollArea.Autosize>
          </div>
        </Paper>
      </div>
    </Stack>
  );
}

function ModeSwitch({ mode, setMode, compact }) {
  return (
    <SegmentedControl size={compact ? 'xs' : 'sm'} value={mode} onChange={setMode} radius="md"
      data={[
        { value: 'editor', label: <Group gap={6} wrap="nowrap"><IconPhoto size={14} />{!compact && 'Editor'}</Group> },
        { value: 'batch', label: <Group gap={6} wrap="nowrap"><IconStack2 size={14} />{!compact && 'Batch compress'}</Group> },
      ]} />
  );
}

