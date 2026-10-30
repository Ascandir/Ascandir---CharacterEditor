import React, { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n.js';

// In-app replacements for window.confirm / window.prompt.
// Native dialogs break keyboard focus in Electron (and prompt() is not supported there at all).
let push = null;
export function confirmDialog(text) { return new Promise(resolve => push?.({ kind: 'confirm', text, resolve })); }
export function promptDialog(text, value = '') { return new Promise(resolve => push?.({ kind: 'prompt', text, value, resolve })); }

export function DialogHost() {
  const { t } = useT();
  const [d, setD] = useState(null);
  const [val, setVal] = useState('');
  const ref = useRef(null);
  useEffect(() => { push = (x) => { setVal(x.value || ''); setD(x); }; return () => { push = null; }; }, []);
  useEffect(() => { if (d) setTimeout(() => ref.current?.focus(), 30); }, [d]);
  if (!d) return null;
  const close = (result) => { d.resolve(result); setD(null); };
  const ok = () => close(d.kind === 'prompt' ? (val.trim() || null) : true);
  const cancel = () => close(d.kind === 'prompt' ? null : false);
  return (
    <div className="modal-bg" style={{ zIndex: 80 }} onClick={cancel}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        onKeyDown={e => { if (e.key === 'Escape') cancel(); if (e.key === 'Enter') ok(); }}>
        <div className="bold">{d.text}</div>
        {d.kind === 'prompt' && <input ref={ref} value={val} onChange={e => setVal(e.target.value)} aria-label={d.text} />}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={cancel}>{t.cancel}</button>
          <button className="btn primary" ref={d.kind === 'confirm' ? ref : undefined} onClick={ok}>{t.confirm}</button>
        </div>
      </div>
    </div>
  );
}
