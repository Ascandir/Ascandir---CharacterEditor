import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import AiSetup, { useAiProgress } from './AiSetup.jsx';
import { confirmDialog } from './Dialog.jsx';

const CTYPES = ['checkpoint', 'zimage', 'zimage-lora'];

// own image models: from a link (Hugging Face, Civitai, direct) or a local .safetensors file
function CustomModels({ st, busy, act, prog }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('checkpoint');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState(null);
  const [edit, setEdit] = useState(null);
  const list = st.customModels || [];
  const add = (fromFile) => act('add', async () => {
    setErr(null);
    try { const id = await api.ai.addCustom({ type, name: name.trim() || (fromFile ? '' : url.split('/').pop().split('?')[0]), url: fromFile ? null : url.trim() }); if (id) { setName(''); setUrl(''); } }
    catch (e) { const m = String(e.message || e); setErr(/CIVITAI_LOGIN/.test(m) ? t.cmCivitaiLogin : /CIVITAI_VERSION/.test(m) ? t.cmCivitaiVersion : /BAD_URL/.test(m) ? t.cmBadUrl : /NOT_A_MODEL/.test(m) ? t.cmNotModel : m); }
  });
  return (
    <div className="col" style={{ gap: 6, padding: 10, borderRadius: 10, background: 'var(--panel2)' }}>
      <div className="row small"><b className="grow">{t.cmTitle}</b><button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? '▾' : '▸ ' + t.cmAdd}</button></div>
      {list.length === 0 && !open && <span className="muted small">{t.cmNone}</span>}
      {list.map(m => (
        <div key={m.id} className="col" style={{ gap: 4 }}>
          <div className="row small" style={{ gap: 8 }}>
            <b className="grow">{m.name}</b><span className="muted">{t['cmType_' + m.type]} · {(m.size / 1e9).toFixed(1)} GB{m.present ? '' : ' · ' + t.aiNotInstalled}</span>
            <button className="btn sm ghost" onClick={() => setEdit(edit === m.id ? null : m.id)}>⚙</button>
            <button className="btn sm ghost" disabled={!!busy} onClick={async () => { if (await confirmDialog(t.aiRemoveAsk(m.name))) act('rm', () => api.ai.removeModel(m.id)); }}>{t.aiRemove}</button>
          </div>
          {edit === m.id && (
            <div className="row small wrap" style={{ gap: 8, paddingLeft: 8 }}>
              {m.type === 'zimage-lora' ? (
                <label className="row" style={{ gap: 4 }}>{t.cmStrength}<input type="number" step="0.05" min="0" max="2" defaultValue={m.strength ?? 0.8} style={{ width: 70 }} onBlur={e => api.ai.updateCustom(m.id, { strength: Number(e.target.value) || 0.8 })} /></label>
              ) : <>
                <label className="row" style={{ gap: 4 }}>{t.cmSteps}<input type="number" min="1" max="100" defaultValue={m.steps} style={{ width: 60 }} onBlur={e => api.ai.updateCustom(m.id, { steps: Number(e.target.value) || m.steps })} /></label>
                <label className="row" style={{ gap: 4 }}>CFG<input type="number" step="0.5" min="1" max="20" defaultValue={m.cfg} style={{ width: 60 }} onBlur={e => api.ai.updateCustom(m.id, { cfg: Number(e.target.value) || m.cfg })} /></label>
                <label className="row" style={{ gap: 4 }}>Sampler<select defaultValue={m.sampler} onChange={e => api.ai.updateCustom(m.id, { sampler: e.target.value })}>
                  {['euler', 'euler_ancestral', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_sde', 'res_multistep', 'uni_pc'].map(x => <option key={x} value={x}>{x}</option>)}</select></label>
              </>}
              <span className="muted">{t.cmSettingsHint}</span>
            </div>
          )}
        </div>
      ))}
      {open && (
        <div className="col" style={{ gap: 6 }}>
          <label className="row small" style={{ gap: 6 }}>{t.cmTypeL}
            <select value={type} onChange={e => setType(e.target.value)}>{CTYPES.map(x => <option key={x} value={x}>{t['cmType_' + x]}</option>)}</select></label>
          <span className="muted small">{t['cmTypeHint_' + type]}</span>
          <input value={name} placeholder={t.cmName} onChange={e => setName(e.target.value)} />
          <div className="row" style={{ gap: 6 }}>
            <input className="grow" value={url} placeholder={t.cmUrl} onChange={e => setUrl(e.target.value)} />
            <button className="btn sm primary" disabled={!!busy || !url.trim()} onClick={() => add(false)}>{t.cmInstall}</button>
          </div>
          <div className="row small" style={{ gap: 6 }}><span className="muted">{t.cmOr}</span><button className="btn sm" disabled={!!busy} onClick={() => add(true)}>{t.cmFromFile}</button></div>
          <span className="muted small">{t.cmUrlHint}</span>
          <label className="row small" style={{ gap: 6 }}>{t.cmCivitaiKey}
            <input type="password" value={key} placeholder={st.hasCivitaiKey ? '••••••••' : ''} onChange={e => setKey(e.target.value)} style={{ flex: 1 }} />
            <button className="btn sm" disabled={!key.trim()} onClick={async () => { await api.ai.setCivitaiKey(key); setKey(''); act('key', async () => {}); }}>{t.save}</button></label>
          {busy === 'add' && prog && <span className="small">{prog.label} · {prog.pct ?? 0} %</span>}
          {busy === 'add' && <button className="btn sm" onClick={() => api.ai.cancel()}>{t.cancel}</button>}
        </div>
      )}
      {err && <span className="small" style={{ color: 'var(--bad)', whiteSpace: 'pre-wrap' }}>{err}</span>}
    </div>
  );
}

// TRELLIS.2 / Pixal3D weights
function Models3D() {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () => api.trellis.status().then(setSt).catch(() => setSt(null));
  useEffect(() => { load(); return api.trellis.on('trellis:state', load); }, []);
  if (!st?.installed) return null;
  const rm = async (what, name) => { if (!(await confirmDialog(t.aiRemoveAsk(name)))) return; setBusy(true); try { await api.trellis.removeModels(what); } catch { /* ignore */ } setBusy(false); load(); };
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row small" style={{ gap: 8 }}><b className="grow">TRELLIS.2 (3D)</b><span className="muted">{st.own ? (st.cfg?.quant || '').toUpperCase() : 'Trellis Studio'}</span>
        {st.own && <button className="btn sm ghost" disabled={busy} onClick={() => rm('trellis', 'TRELLIS.2')}>{t.aiRemove}</button>}</div>
      {st.pixalOk && <div className="row small" style={{ gap: 8 }}><b className="grow">Pixal3D (3D)</b><span className="muted">{t.aiInstalled}</span>
        <button className="btn sm ghost" disabled={busy} onClick={() => rm('pixal3d', 'Pixal3D')}>{t.aiRemove}</button></div>}
    </div>
  );
}

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
            {models.map(([id, m]) => (
              <div key={id} className="row small" style={{ gap: 8 }}><b className="grow">{m.name}</b><span className="muted">{m.present ? t.aiInstalled + ' · v' + m.version : t.aiNotInstalled}</span>
                <button className="btn sm ghost" disabled={!!busy} title={t.aiRemove} onClick={async () => { if (await confirmDialog(t.aiRemoveAsk(m.name) + (id === 'z-image-turbo' ? '\n\n' + t.aiRemoveZ : ''))) act('rm', () => api.ai.removeModel(id)); }}>{t.aiRemove}</button></div>
            ))}
          </div>
          <CustomModels st={st} busy={busy} act={act} prog={prog} />
          <Models3D />
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
