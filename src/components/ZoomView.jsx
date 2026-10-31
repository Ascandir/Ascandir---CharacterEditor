import React, { useEffect, useRef, useState } from 'react';

// Image viewer: mouse wheel zooms toward the cursor, drag pans, double click resets
export default function ZoomView({ src, empty, labels = {} }) {
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
      style={{ flex: 1, minHeight: 520, height: 640, borderRadius: 14, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden', cursor: src ? (drag.current ? 'grabbing' : 'grab') : 'default', touchAction: 'none', userSelect: 'none' }}>
      {src ? (
        <img src={src} alt="" draggable={false} style={{ position: 'absolute', left: '50%', top: '50%', maxWidth: '100%', maxHeight: '100%', transform: `translate(-50%, -50%) translate(${v.x}px, ${v.y}px) scale(${v.s})`, transformOrigin: 'center' }} />
      ) : <span className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{empty}</span>}
      {src && (
        <div className="row" style={{ position: 'absolute', right: 10, bottom: 10, gap: 4, background: 'rgba(15,17,21,.75)', borderRadius: 10, padding: 4 }} onPointerDown={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
          <button className="btn sm" aria-label="zoom out" onClick={() => zoomAt(1 / 1.25, 0, 0)}>−</button>
          <span className="small" style={{ minWidth: 44, textAlign: 'center' }}>{Math.round(v.s * 100)} %</span>
          <button className="btn sm" aria-label="zoom in" onClick={() => zoomAt(1.25, 0, 0)}>+</button>
          <button className="btn sm" onClick={() => setV({ s: 1, x: 0, y: 0 })} title={labels.hint}>{labels.fit || 'Fit'}</button>
        </div>
      )}
    </div>
  );
}
