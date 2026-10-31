import React, { useEffect, useRef, useState } from 'react';

// Image viewer: mouse wheel zooms toward the cursor, drag pans, double click resets
const HKEY = 'ace.zoomview.height';
function savedHeight() { try { const v = Number(localStorage.getItem(HKEY)); return v > 150 ? v : null; } catch { return null; } }

export default function ZoomView({ src, empty, labels = {}, reserve = 170 }) {
  const [hgt, setHgt] = useState(savedHeight); // null = follow window size
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
  useEffect(() => {
    const el = box.current; if (!el) return;
    const onWheel = e => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const down = e => { if (e.button !== 0) return; drag.current = { px: e.clientX, py: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = e => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.px, dy = e.clientY - drag.current.py;
    drag.current = { px: e.clientX, py: e.clientY };
    setV(o => ({ ...o, x: o.x + dx, y: o.y + dy }));
  };
  const up = () => { drag.current = null; };

  return (
    <div ref={box} className="checker zoomview" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      onDoubleClick={() => setV({ s: 1, x: 0, y: 0 })}
      style={{ flex: 'none', height: (hgt || autoH) + 'px', borderRadius: 14, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', cursor: src ? (drag.current ? 'grabbing' : 'grab') : 'default', touchAction: 'none', userSelect: 'none' }}>
      {src ? (
        <img src={src} alt="" draggable={false} style={{ position: 'absolute', left: '50%', top: '50%', maxWidth: '100%', maxHeight: '100%', transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.s})`, transformOrigin: 'center' }} />
      ) : <span className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{empty}</span>}
      <div title={labels.resize} onPointerDown={startResize} onDoubleClick={e => { e.stopPropagation(); resetHeight(); }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, cursor: 'ns-resize', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2 }}>
        <div style={{ width: 48, height: 4, borderRadius: 2, background: 'var(--line)' }} />
      </div>
      {src && (
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
