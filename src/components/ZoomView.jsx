import React, { useEffect, useRef, useState } from 'react';

// Image viewer: mouse wheel zooms toward the cursor, drag pans, double click resets
const HKEY = 'ace.zoomview.height';
function savedHeight() { try { const v = Number(localStorage.getItem(HKEY)); return v > 150 ? v : null; } catch { return null; } }

export default function ZoomView({ src, empty, labels = {}, reserve = 170, fill = false, onOpen = null }) {
  const hgt = null; // height follows the window (manual resizing was removed)
  const setHgt = () => {};
  const resizing = useRef(null);
  const startResize = e => {
    e.preventDefault(); e.stopPropagation();
    const h0 = box.current.getBoundingClientRect().height; const y0 = e.clientY;
    resizing.current = true;
    const mv = ev => setHgt(Math.max(200, Math.min(window.innerHeight * 1.5, h0 + ev.clientY - y0)));
    const upH = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', upH); resizing.current = null;
      setHgt(h => { try { localStorage.setItem(HKEY, String(Math.round(h))); } catch { /* ignore */ } return h; }); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', upH);
  };
  // auto height: fill the window from the box's top edge, leaving room for the gallery below
  const [autoH, setAutoH] = useState(400);
  useEffect(() => {
    const fit = () => { const el = box.current; if (!el) return; let sc = el.parentElement; while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      const scTop = sc && sc !== document.body ? sc.getBoundingClientRect().top : 0;
      const top = el.getBoundingClientRect().top - scTop + (sc && sc !== document.body ? sc.scrollTop : window.scrollY) + scTop; setAutoH(Math.max(260, window.innerHeight - top - reserve)); };
    fit(); const t = setTimeout(fit, 300);
    window.addEventListener('resize', fit);
    const ro = new ResizeObserver(fit); if (box.current?.parentElement?.parentElement) ro.observe(box.current.parentElement.parentElement);
    return () => { clearTimeout(t); window.removeEventListener('resize', fit); ro.disconnect(); };
  }, [reserve]);
  const resetHeight = () => { setHgt(null); try { localStorage.removeItem(HKEY); } catch { /* ignore */ } };
  const box = useRef(null);
  const [v, setV] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef(null);
  useEffect(() => { setV({ s: 1, x: 0, y: 0 }); }, [src]);

  const zoomAt = (factor, cx, cy) => setV(o => {
    const s = Math.min(12, Math.max(0.25, o.s * factor));
    const f = s / o.s;
    // keep the point under the cursor fixed (coordinates relative to the box centre)
    return { s, x: cx - (cx - o.x) * f, y: cy - (cy - o.y) * f };
  });
  // with onOpen this is only a preview: no zoom / pan (the mouse wheel scrolls the page), a click opens the big view
  const interactive = !onOpen;
  useEffect(() => {
    const el = box.current; if (!el || !interactive) return;
    const onWheel = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive]);

  const down = e => { if (e.button !== 0) return; drag.current = { px: e.clientX, py: e.clientY, sx: e.clientX, sy: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!drag.current || !interactive) return;
    const dx = e.clientX - drag.current.px, dy = e.clientY - drag.current.py;
    drag.current = { ...drag.current, px: e.clientX, py: e.clientY };
    setV(o => ({ ...o, x: o.x + dx, y: o.y + dy }));
  };
  const up = (e) => {
    const d = drag.current; drag.current = null;
    // a click without dragging opens the big view
    if (d && onOpen && src && e?.type === 'pointerup' && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) onOpen();
  };

  return (
    <div ref={box} className="checker zoomview" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onDoubleClick={() => { if (!onOpen) setV({ s: 1, x: 0, y: 0 }); }}
      title={onOpen && src ? labels.open : undefined}
      style={{ flex: fill ? 1 : 'none', height: fill ? '100%' : (hgt || autoH) + 'px', borderRadius: 14, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', cursor: src ? (onOpen ? 'zoom-in' : (drag.current ? 'grabbing' : 'grab')) : 'default', touchAction: interactive ? 'none' : 'auto', userSelect: 'none' }}>
      {src ? (
        <img src={src} alt="" draggable={false} style={{ position: 'absolute', left: '50%', top: '50%', maxWidth: '100%', maxHeight: '100%', transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.s})`, transformOrigin: 'center' }} />
      ) : <span className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{empty}</span>}
      {src && interactive && (
        <div className="row" style={{ position: 'absolute', right: 10, bottom: 14, gap: 4, background: 'rgba(15,17,21,.75)', borderRadius: 10, padding: 4 }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
          <button className="btn sm" aria-label="zoom out" onClick={() => zoomAt(1 / 1.25, 0, 0)}>−</button>
          <span className="small" style={{ minWidth: 44, textAlign: 'center' }}>{Math.round(v.s * 100)} %</span>
          <button className="btn sm" aria-label="zoom in" onClick={() => zoomAt(1.25, 0, 0)}>+</button>
          <button className="btn sm" onClick={() => setV({ s: 1, x: 0, y: 0 })} title={labels.hint}>{labels.fit || 'Fit'}</button>
        </div>
      )}
    </div>
  );
}

// big view in a popup: wheel zoom, drag to pan, Esc / click outside closes
export function ImageModal({ src, onClose, labels = {} }) {
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!src) return null;
  return (
    <div className="modal-bg" style={{ zIndex: 75 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '94vw', height: '92vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <ZoomView src={src} fill labels={labels} />
        <button className="btn sm" style={{ position: 'absolute', top: 10, right: 10 }} onClick={onClose} aria-label={labels.close || 'Close'}>✕</button>
      </div>
    </div>
  );
}
