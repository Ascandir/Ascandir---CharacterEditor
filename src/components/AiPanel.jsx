import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import AiSetup, { useAiProgress } from './AiSetup.jsx';

function TdrBox() {
  const { t } = useT();
  const [tdr, setTdr] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.tdr?.().then(setTdr).catch(() => setTdr(null));
  useEffect(() => { load(); }, []);
  if (!tdr?.supported) return null;
  const raised = (tdr.delay || 0) >= 10;
  const apply = async (v) => { setBusy(true); try { await api.setTdr(v); } catch { /* declined */ } const r = await api.tdr().catch(() => null); setTdr(r ? { ...r, changed: (r.delay || null) !== (tdr.delay || null) } : null); setBusy(false); };
  return (
    <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: 'var(--panel2)' }}>
      <span className="bold small">{t.tdrTitle}</span>
      <span className="muted small">{t.tdrHint}</span>
      <span className="small">{t.tdrNow(tdr.delay ?? 2)}{raised ? '' : ' ' + t.tdrDefault}</span>
      <div className="row" style={{ gap: 8 }}>
        {!raised && <button className="btn sm primary" disabled={busy} onClick={() => apply(60)}>{t.tdrRaise}</button>}
        {raised && <button className="btn sm" disabled={busy} onClick={() => apply(0)}>{t.tdrReset}</button>}
      </div>
      {busy && <span className="muted small">{t.tdrBusy}</span>}
      {tdr.changed && <span className="small" style={{ color: 'var(--accent2)' }}>{t.tdrReboot}</span>}
    </div>
  );
}

export default function AiPanel() {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [upd, setUpd] = useState(null);
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [prog] = useAiProgress();
  const refresh = () => api.ai.status().then(setSt);
  useEffect(() => { refresh(); return api.ai.on('ai:state', refresh); }, []);
  if (!st) return null;
  if (!st.supported) return <div className="banner info" style={{ margin: 0 }}>{t.aiWinOnly}</div>;
  const act = async (label, fn) => { setBusy(label); setErr(null); try { await fn(); } catch (e) { setErr(String(e.message || e)); } setBusy(null); refresh(); };
  const models = Object.entries(st.models || {});
  return (
    <div className="col" style={{ gap: 12 }}>
      {!st.comfyInstalled || setup ? (
        <AiSetup compact onDone={() => { setSetup(false); refresh(); }} onSkip={st.comfyInstalled ? () => setSetup(false) : null} />
      ) : (
        <>
          <div className="row">
            <span className="dot" style={{ background: st.running ? 'var(--ok)' : st.starting ? 'var(--accent)' : 'var(--dim)' }} />
            <span className="grow">{st.running ? t.aiRunning : st.starting ? t.aiStarting : t.aiStopped}</span>
            {st.running ? <button className="btn sm" disabled={!!busy} onClick={() => act('stop', api.ai.stop)}>{t.aiStop}</button>
              : <button className="btn sm" disabled={!!busy} onClick={() => act('start', api.ai.start)}>{busy === 'start' ? '…' : t.aiStart}</button>}
            <button className="btn sm" onClick={() => api.ai.openDir()}>{t.aiOpenFolder}</button>
          </div>
          <div className="col" style={{ gap: 4 }}>
            <div className="row small"><b className="grow">ComfyUI</b><span className="muted">{st.comfyVersion || t.aiInstalled}</span></div>
            {models.map(([id, m]) => <div key={id} className="row small"><b className="grow">{m.name}</b><span className="muted">{m.present ? t.aiInstalled + ' · v' + m.version : t.aiNotInstalled}</span></div>)}
          </div>
          <label className="row small" title={t.gpuModeHint}>{t.gpuMode}
            <select value={st.gpuMode || 'safe'} onChange={async e => { await api.ai.setGpuMode(e.target.value); refresh(); }}>
              <option value="safe">{t.gpuSafe}</option><option value="balanced">{t.gpuBalanced}</option><option value="fast">{t.gpuFast}</option>
            </select></label>
          <span className="muted small">{t.gpuModeHint}</span>
          <TdrBox />
          <label className="checkline small"><input type="checkbox" checked={st.stopAfterImage !== false} onChange={async e => { await api.ai.setStopAfter?.(e.target.checked); refresh(); }} /><span>{t.aiStopAfter}<br /><span className="muted">{t.aiStopAfterHint}</span></span></label>
          <label className="row small">{t.aiIdle}
            <select value={st.idleMinutes} onChange={async e => { await api.ai.setIdle(Number(e.target.value)); refresh(); }}>{[0, 5, 10, 30, 60].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <div className="row">
            <button className="btn sm" disabled={!!busy} onClick={() => act('upd', async () => setUpd(await api.ai.updates()))}>{busy === 'upd' ? '…' : t.aiUpdatesCheck}</button>
            <button className="btn sm" onClick={() => setSetup(true)}>{t.aiRerun}</button>
          </div>
          {upd && (
            <div className="col" style={{ gap: 6 }}>
              {upd.comfy?.update && (
                <div className="row small"><span className="grow">ComfyUI {upd.comfy.installed} → <b>{upd.comfy.latest}</b></span>
                  <button className="btn sm primary" disabled={!!busy} onClick={() => act('cu', () => api.ai.install({ dir: st.dir, gpu: st.gpu, models: [], comfy: true }))}>{t.aiUpdate}</button></div>
              )}
              {upd.models.filter(m => m.update).map(m => (
                <div key={m.id} className="row small"><span className="grow">{m.name} v{m.installed} → <b>v{m.version}</b></span>
                  <button className="btn sm primary" disabled={!!busy} onClick={() => act('mu', () => api.ai.install({ dir: st.dir, gpu: st.gpu, models: [m.id], comfy: false }))}>{t.aiUpdate}</button></div>
              ))}
              {upd.models.filter(m => m.recommended && !m.installed).map(m => (
                <div key={m.id} className="row small"><span className="grow">{t.aiRecommended}: <b>{m.name}</b></span>
                  <button className="btn sm" onClick={() => setSetup(true)}>{t.aiRerun}</button></div>
              ))}
              {!upd.comfy?.update && !upd.models.some(m => m.update || (m.recommended && !m.installed)) && <span className="muted small">{t.aiNoUpdates}</span>}
            </div>
          )}
          {busy && prog && ['cu', 'mu'].includes(busy) && <span className="small">{prog.label} · {prog.pct ?? 0} %</span>}
          {err && <span className="small" style={{ color: 'var(--bad)' }}>{err}</span>}
        </>
      )}
    </div>
  );
}
