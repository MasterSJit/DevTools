import { useCallback, useRef } from 'react';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
const MIN = 8;

/**
 * Interactive crop box drawn over an image of natural size `imgW`×`imgH`, displayed at `displayW`×`displayH`.
 * `rect` is in image pixels. `aspect` (w/h) locks the ratio when set.
 */
export default function CropOverlay({ imgW, imgH, displayW, displayH, rect, onChange, aspect }) {
  const drag = useRef(null);
  const k = displayW / imgW; // image px → screen px

  const clampRect = useCallback((r) => {
    let { x, y, w, h } = r;
    w = Math.max(MIN, Math.min(w, imgW)); h = Math.max(MIN, Math.min(h, imgH));
    x = Math.max(0, Math.min(x, imgW - w)); y = Math.max(0, Math.min(y, imgH - h));
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
  }, [imgW, imgH]);

  const onPointerDown = (mode) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: rect };
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
    const s = d.start;
    if (d.mode === 'move') { onChange(clampRect({ ...s, x: s.x + dx, y: s.y + dy })); return; }
    let { x, y, w, h } = s;
    const right = s.x + s.w, bottom = s.y + s.h;
    if (d.mode.includes('e')) w = Math.min(imgW - s.x, Math.max(MIN, s.w + dx));
    if (d.mode.includes('s')) h = Math.min(imgH - s.y, Math.max(MIN, s.h + dy));
    if (d.mode.includes('w')) { x = Math.max(0, Math.min(right - MIN, s.x + dx)); w = right - x; }
    if (d.mode.includes('n')) { y = Math.max(0, Math.min(bottom - MIN, s.y + dy)); h = bottom - y; }
    if (aspect) {
      // Drive by the dominant axis, then fit inside the image bounds.
      if (d.mode === 'n' || d.mode === 's') w = h * aspect;
      else if (d.mode === 'e' || d.mode === 'w') h = w / aspect;
      else if (Math.abs(dx) > Math.abs(dy)) h = w / aspect; else w = h * aspect;
      const maxW = d.mode.includes('w') ? right : imgW - x;
      const maxH = d.mode.includes('n') ? bottom : imgH - y;
      if (w > maxW) { w = maxW; h = w / aspect; }
      if (h > maxH) { h = maxH; w = h * aspect; }
      if (d.mode.includes('w')) x = right - w;
      if (d.mode.includes('n')) y = bottom - h;
      if (d.mode === 'n' || d.mode === 's') x = s.x + (s.w - w) / 2;
      if (d.mode === 'e' || d.mode === 'w') y = s.y + (s.h - h) / 2;
    }
    onChange(clampRect({ x, y, w, h }));
  };

  const end = () => { drag.current = null; };

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 1;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    onChange(clampRect({ ...rect, x: rect.x + map[e.key][0], y: rect.y + map[e.key][1] }));
  };

  const box = { left: rect.x * k, top: rect.y * k, width: rect.w * k, height: rect.h * k };

  return (
    <div className="absolute inset-0 overflow-hidden select-none" style={{ width: displayW, height: displayH, touchAction: 'none' }}
      onPointerMove={onPointerMove} onPointerUp={end} onPointerCancel={end}>
      <div role="group" aria-roledescription="crop area" aria-label={`Crop area ${rect.w} by ${rect.h} — drag to move, arrow keys to nudge`} tabIndex={0} onKeyDown={onKeyDown}
        className="absolute outline-none" onPointerDown={onPointerDown('move')}
        style={{ ...box, cursor: 'move', boxShadow: '0 0 0 9999px rgba(8,8,12,0.62)', border: '1.5px solid rgba(255,255,255,0.95)' }}>
        {/* rule of thirds */}
        {[1, 2].map((i) => (
          <div key={`v${i}`} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${(i * 100) / 3}%`, borderLeft: '1px solid rgba(255,255,255,0.35)' }} />
        ))}
        {[1, 2].map((i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${(i * 100) / 3}%`, borderTop: '1px solid rgba(255,255,255,0.35)' }} />
        ))}
        {HANDLES.map((h) => {
          const corner = h.length === 2;
          const pos = {
            left: h.includes('w') ? 0 : h.includes('e') ? '100%' : '50%',
            top: h.includes('n') ? 0 : h.includes('s') ? '100%' : '50%',
          };
          return (
            <div key={h} onPointerDown={onPointerDown(h)} className="absolute"
              style={{ ...pos, width: 22, height: 22, transform: 'translate(-50%,-50%)', cursor: CURSORS[h], display: 'grid', placeItems: 'center' }}>
              <div style={{
                width: corner ? 14 : h === 'n' || h === 's' ? 22 : 5, height: corner ? 14 : h === 'e' || h === 'w' ? 22 : 5,
                background: '#fff', borderRadius: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }} />
            </div>
          );
        })}
        <div className="absolute pointer-events-none text-[11px] font-mono px-1.5 py-0.5 rounded"
          style={{ left: 6, top: 6, background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
          {rect.w} × {rect.h}
        </div>
      </div>
    </div>
  );
}
