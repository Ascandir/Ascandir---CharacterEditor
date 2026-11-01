import React, { useEffect, useState } from 'react';
import { useT } from '../i18n.js';

// textarea with a ⤢ button that opens the same text in a large window for editing / reading
export default function BigText({ value, onChange, onBlur, title, style, ...rest }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const close = () => { setOpen(false); onBlur?.(); };
  useEffect(() => {
    if (!open) return;
    const k = e => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  const words = (value || '').trim() ? (value || '').trim().split(/\s+/).length : 0;
  return (
    <div className="bigtext">
      <textarea value={value} onChange={onChange} onBlur={onBlur} style={{ ...style, width: '100%', paddingRight: 30 }} {...rest} />
      <button type="button" className="bigtext-btn" title={t.bigOpen} aria-label={t.bigOpen} onClick={() => setOpen(true)}>⤢</button>
      {open && (
        <div className="modal-bg" style={{ zIndex: 80 }} onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
          <div className="modal" style={{ maxWidth: 1100, height: 'calc(100vh - 80px)' }}>
            <div className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
              <b>{title || rest['aria-label'] || ''}</b>
              <div className="row" style={{ gap: 10 }}>
                <span className="muted small">{t.bigCount((value || '').length, words)}</span>
                <button type="button" className="btn sm" onClick={() => navigator.clipboard?.writeText(value || '')}>{t.bigCopy}</button>
                <button type="button" className="btn sm primary" onClick={close}>{t.bigDone}</button>
              </div>
            </div>
            <textarea autoFocus value={value} onChange={onChange} placeholder={rest.placeholder} readOnly={rest.readOnly}
              style={{ flex: 1, resize: 'none', fontSize: 15, lineHeight: 1.55, padding: 14 }} />
          </div>
        </div>
      )}
    </div>
  );
}
