import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';

export function useUpdater() {
  const [info, setInfo] = useState(null);
  const [state, setState] = useState('idle'); // idle | checking | none | available | downloading | installing | error
  const [pct, setPct] = useState(0);
  const [err, setErr] = useState('');
  useEffect(() => api.onUpdateProgress?.(setPct), []);
  const check = async () => {
    setState('checking'); setErr('');
    try { const r = await api.checkUpdate(); setInfo(r); setState(r.available ? 'available' : 'none'); return r; }
    catch (e) { setErr(String(e.message || e)); setState('error'); return null; }
  };
  const install = async () => {
    if (!info) return;
    setState('downloading'); setPct(0);
    try { await api.installUpdate({ url: info.url, name: info.name }); setState('installing'); }
    catch (e) { setErr(String(e.message || e)); setState('error'); }
  };
  return { info, state, pct, err, check, install };
}

export function UpdateBody({ u, compact }) {
  const { t } = useT();
  return (
    <div className="col" style={{ gap: 10 }}>
      {u.state === 'none' && <span className="muted small">{t.upToDate}</span>}
      {u.state === 'error' && <span className="small" style={{ color: 'var(--bad)' }}>{t.updateErr}: {u.err}</span>}
      {(u.state === 'available' || u.state === 'downloading' || u.state === 'installing') && u.info && (
        <>
          <b style={{ color: 'var(--accent2)' }}>{t.updateAvail(u.info.version)}</b>
          {!compact && u.info.notes && (
            <details><summary className="muted small" style={{ cursor: 'pointer' }}>{t.updateNotes}</summary>
              <pre className="small muted" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '8px 0 0' }}>{u.info.notes}</pre></details>
          )}
          {u.state === 'available' && <button className="btn primary" onClick={u.install}>{t.updateInstall}{u.info.size ? ` (${Math.round(u.info.size / 1048576)} MB)` : ''}</button>}
          {u.state === 'downloading' && (
            <div className="col" style={{ gap: 6 }}>
              <span className="small">{t.updateLoading(u.pct)}</span>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}><div style={{ width: u.pct + '%', height: 6, borderRadius: 3, background: 'var(--accent)' }} /></div>
            </div>
          )}
          {u.state === 'installing' && <span className="small">{t.updateRestart}</span>}
        </>
      )}
    </div>
  );
}
