import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { primaryGpu } from '../hardware.js';

const fmtGB = (n) => (n == null ? '?' : n.toFixed(n < 10 ? 1 : 0).replace('.', ',')) + ' GB';
const fmtSpeed = (b) => (b / 1e6).toFixed(1).replace('.', ',') + ' MB/s';

export function useAiProgress() {
  const [p, setP] = useState(null);
  useEffect(() => api.ai.on('ai:progress', setP), []);
  return [p, setP];
}

// The setup wizard: folder, models, download/extract with progress. Used at first start and from settings.
export default function AiSetup({ onDone, onSkip, compact }) {
  const { t, lang } = useT();
  const [st, setSt] = useState(null);
  const [cat, setCat] = useState(null);
  const [gpu, setGpu] = useState(null);
  const [dir, setDir] = useState(null);
  const [free, setFree] = useState(null);
  const [sel, setSel] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [prog, setProg] = useAiProgress();
  useEffect(() => {
    (async () => {
      const s = await api.ai.status(); setSt(s); setDir(s.dir || s.defaultDir); setFree(s.freeGB);
      const u = await api.ai.updates(); setCat(u);
      setSel(Object.fromEntries((u.models || []).filter(m => m.recommended || m.installed).map(m => [m.id, true])));
      const hw = await api.hardware(); setGpu(primaryGpu(hw));
    })().catch(e => setErr(String(e.message || e)));
  }, []);
  if (!st) return <div className="muted">…</div>;
  if (!st.supported) return <div className="banner info" style={{ margin: 0 }}>{t.aiWinOnly}</div>;
  const vendor = gpu?.vendor === 'nvidia' ? 'nvidia' : 'amd';
  const models = cat?.models || [];
  const totalGB = (st.comfyInstalled ? 0 : 6) + models.filter(m => sel[m.id] && !m.installed).reduce((a, m) => a + m.sizeGB, 0);
  const run = async () => {
    setBusy(true); setErr(null); setProg(null);
    try {
      await api.ai.install({ dir, gpu: vendor, models: models.filter(m => sel[m.id]).map(m => m.id), comfy: !st.comfyInstalled });
      onDone && onDone();
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(false);
  };
  return (
    <div className="col" style={{ gap: 14 }}>
      {!compact && <p className="muted" style={{ margin: 0 }}>{t.aiSetupIntro}</p>}
      <div className="grid g2">
        <div className="tile" style={{ textAlign: 'left' }}><div className="lab">{t.hardware}</div><div className="bold" style={{ marginTop: 4 }}>{gpu?.name || '—'}</div>
          <div className="muted small">{vendor === 'amd' ? 'AMD ROCm' : 'NVIDIA CUDA'}</div></div>
        <div className="tile" style={{ textAlign: 'left' }}><div className="lab">{t.aiFree}</div><div className="bold" style={{ marginTop: 4 }}>{fmtGB(free)}</div>
          <div className="muted small">{t.aiNeeded}: ~{fmtGB(totalGB)}</div></div>
      </div>
      {gpu?.status === 'old' && <div className="banner" style={{ margin: 0 }}>{t.driver}: {t.driverOld}. {t.driverNote}</div>}
      <div className="col" style={{ gap: 6 }}>
        <span className="bold">{t.aiFolder}</span>
        <div className="row">
          <code className="grow" style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dir}</code>
          <button className="btn sm" disabled={busy} onClick={async () => { try { const r = await api.ai.chooseDir(); if (r) { setDir(r.dir); setFree(r.freeGB); } } catch (e) { setErr(String(e.message || e).replace(/^Error invoking remote method[^:]*: (Error: )?/, '')); } }}>{t.aiChange}</button>
        </div>
        {st.programModelsDir && dir !== st.programModelsDir && (
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={() => setDir(st.programModelsDir)}>{t.aiUseProgramDir}</button>
        )}
        {st.programModelsDir && dir === st.programModelsDir && <span className="muted small">{t.aiProgramDirNote}</span>}
        {st.dir && dir !== st.dir && st.comfyInstalled && <span className="small" style={{ color: 'var(--accent2)' }}>{t.aiMoveNote(st.dir)}</span>}
      </div>
      <div className="col" style={{ gap: 6 }}>
        <span className="bold">{t.aiModels}</span>
        <label className="listbtn"><input type="checkbox" checked disabled /><span className="grow"><b>ComfyUI</b> <span className="muted small">{vendor === 'amd' ? '+ AMD ROCm' : '+ NVIDIA CUDA'} · {t.aiEngine}</span></span>
          <span className="muted small">{st.comfyInstalled ? '✓ ' + (st.comfyVersion || '') : '~6 GB'}</span></label>
        {models.map(m => (
          <label key={m.id} className={'listbtn' + (sel[m.id] ? ' sel' : '')} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!sel[m.id]} disabled={busy} onChange={e => setSel({ ...sel, [m.id]: e.target.checked })} />
            <span className="grow col" style={{ gap: 2 }}>
              <span><b>{m.name}</b> {m.recommended && <span className="tag">{t.aiRecommended}</span>}</span>
              <span className="muted small">{m.note?.[lang] || ''}</span>
            </span>
            <span className="muted small">{m.installed ? '✓' : '~' + fmtGB(m.sizeGB)}</span>
          </label>
        ))}
      </div>
      {prog && busy && (
        <div className="col" style={{ gap: 6 }}>
          <span className="small">{prog.phase === 'extract' ? t.aiExtracting : t.aiDownloading}: <b>{prog.label}</b> · {prog.pct ?? 0} %{prog.speed ? ' · ' + fmtSpeed(prog.speed) : ''}{prog.total ? ' · ' + fmtGB(prog.got / 1e9) + ' / ' + fmtGB(prog.total / 1e9) : ''}</span>
          <div style={{ height: 8, borderRadius: 4, background: 'var(--line)' }}><div style={{ width: (prog.pct || 0) + '%', height: 8, borderRadius: 4, background: 'var(--accent)' }} /></div>
        </div>
      )}
      {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small">{err}</span><span className="muted small">{t.aiResume}</span></div>}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {onSkip && !busy && <button className="btn ghost" onClick={onSkip}>{t.aiLater}</button>}
        {busy && <button className="btn" onClick={() => api.ai.cancel()}>{t.cancel}</button>}
        <button className="btn primary" disabled={busy || totalGB > (free ?? 9999)} onClick={run}>{busy ? t.aiInstalling : (st.comfyInstalled ? t.aiInstallSelected : t.aiInstallAll)}</button>
      </div>
    </div>
  );
}
