import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './platform.js';
import { DICTS, LangCtx } from './i18n.js';
import { loadOfficial, buildDb, loadHomebrewFile } from './data/loader.js';
import { derive } from './engine/rules.js';
import Sheet from './views/Sheet.jsx';
import Wizard from './views/Wizard.jsx';
import LevelUp from './views/LevelUp.jsx';
import Sources from './views/Sources.jsx';
import Settings from './views/Settings.jsx';
import Designer from './views/Designer.jsx';
import Sound from './views/Sound.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import CharList from './views/CharList.jsx';
import { primaryGpu, AMD_DRIVER_URL } from './hardware.js';
import { useUpdater, UpdateDialog } from './components/Update.jsx';
import { DialogHost } from './components/Dialog.jsx';
import { DbCtx, RefHost } from './components/Entries.jsx';
import { useJobs, wireJobs, cancelJob, dismissDone, fmtTime, jobPct } from './ai/jobs.js';
import AiSetup from './components/AiSetup.jsx';

export const DEFAULT_SETTINGS = { lang: 'de', rules: '2024', disabledSources: [], homebrew: [], profiles: {}, activeProfile: 'Standard' };

export function newCharacter(settings) {
  const id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return {
    id, name: '', rules: settings.rules || '2024', createdAt: Date.now(), updatedAt: Date.now(),
    raceUid: null, backgroundUid: null, base: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
    abilityGen: { method: 'standard', values: [15, 14, 13, 12, 10, 8], assign: { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }, rule: { n: 4, sides: 6, drop: 1, bonus: 0, sets: 6, ones: false }, log: [] },
    levels: [], choices: {}, extras: [], inventory: [], gold: 0, equipChoices: {}, equipApplied: false, notes: '',
    appearance: { height: 180, build: 45, muscle: 50, age: 30, skin: '#c99a76', hairStyle: 'short', hairColor: '#3b2a1e', head: 'human', armor: 'leather', helmet: false, weapon: 'sword', shield: false, cape: false, style: 'painted', primary: '#7a2e2e' },
    wizardDone: false,
  };
}

export default function App() {
  const [settings, setSettings] = useState(null);
  const [official, setOfficial] = useState(null);
  const [hb, setHb] = useState({}); // path -> json
  const [status, setStatus] = useState({ loading: true, msg: '', error: null });
  const [view, setView] = useState('sheet');
  const [ch, setCh] = useState(null);
  const [showChars, setShowChars] = useState(false);
  const [toast, setToast] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  const lang = settings?.lang || 'de';
  const t = DICTS[lang];
  const showToast = useCallback((m) => { setToast(m); setTimeout(() => setToast(null), 2500); }, []);

  const saveSettings = useCallback((s) => { setSettings(s); api.setSettings(s); }, []);

  // initial load
  const loadAll = useCallback(async (force = false) => {
    setStatus({ loading: true, msg: '', error: null });
    try {
      const s = { ...DEFAULT_SETTINGS, ...(await api.getSettings()) };
      setSettings(s);
      // the character is local: load it first, so designer & settings work even without the 5e.tools data
      if (s.lastCharId) {
        try { const c = await api.loadChar(s.lastCharId); if (c) setCh(prev => prev || c); } catch { /* ignore */ }
      }
      const off = await loadOfficial(m => setStatus(st => ({ ...st, msg: m })), force);
      const hbData = {};
      for (const p of s.homebrew || []) {
        try { hbData[p] = await loadHomebrewFile(p, force); } catch (e) { console.warn('homebrew failed', p, e); }
      }
      setHb(hbData);
      setOfficial(off);
      if (s.lastCharId) {
        try { const c = await api.loadChar(s.lastCharId); if (c) setCh(prev => prev || c); } catch { /* ignore */ }
      }
      setStatus({ loading: false, msg: '', error: null });
    } catch (e) {
      setStatus({ loading: false, msg: '', error: String(e.message || e) });
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  const jobs = useJobs();
  useEffect(() => { wireJobs(); }, []);
  const upd = useUpdater();
  const [showUpd, setShowUpd] = useState(false);
  const updChecked = useRef(false);
  useEffect(() => { if (settings && !updChecked.current && settings.autoUpdate !== false) { updChecked.current = true; upd.check(); } }, [settings]); // eslint-disable-line
  const [driverWarn, setDriverWarn] = useState(null);
  const [aiFirstRun, setAiFirstRun] = useState(false);
  useEffect(() => { api.ai?.status().then(s => { if (s.supported && !s.setupDone && !s.setupSkipped) setAiFirstRun(true); }).catch(() => {}); }, []);
  useEffect(() => { api.hardware().then(info => { const g = primaryGpu(info); if (g?.status === 'old') setDriverWarn(g); }).catch(() => {}); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { document.title = t.appName; }, [t]);

  const db = useMemo(() => {
    if (!official) return null;
    const list = Object.entries(hb).filter(([p]) => settings?.homebrew?.includes(p)).map(([path, json]) => ({ path, json }));
    return buildDb(official, list);
  }, [official, hb, settings?.homebrew]);

  const charSettings = useMemo(() => settings && ch ? { ...settings, rules: ch.rules || settings.rules } : settings, [settings, ch?.rules]);
  const d = useMemo(() => (db && ch ? derive(db, charSettings, ch) : null), [db, ch, charSettings]);

  // autosave
  const update = useCallback((fn) => {
    setCh(prev => {
      const next = typeof fn === 'function' ? fn(structuredClone(prev)) : fn;
      if (!next) return prev;
      next.updatedAt = Date.now();
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        await api.saveChar({ ...next });
        setSavedAt(new Date());
      }, 500);
      return next;
    });
  }, []);
  useEffect(() => {
    if (ch && d && ch.summary !== d.summary) setCh(c => ({ ...c, summary: d.summary }));
  }, [d?.summary]); // eslint-disable-line

  const openChar = useCallback(async (id) => {
    const c = await api.loadChar(id);
    if (c) { setCh(c); saveSettings({ ...settings, lastCharId: id }); setView(c.wizardDone ? 'sheet' : 'wizard'); }
    setShowChars(false);
  }, [settings, saveSettings]);

  const createChar = useCallback(() => {
    const c = newCharacter(settings);
    setCh(c); api.saveChar(c); saveSettings({ ...settings, lastCharId: c.id });
    setView(official ? 'wizard' : 'designer'); setShowChars(false);
  }, [settings, saveSettings, official]);

  const saveNow = useCallback(async () => {
    if (!ch) return;
    await api.saveChar({ ...ch, summary: d?.summary });
    setSavedAt(new Date()); showToast(t.saved);
  }, [ch, d, t, showToast]);

  const addHomebrew = useCallback(async (path, on) => {
    const list = new Set(settings.homebrew || []);
    if (on) {
      if (!hb[path]) {
        showToast(t.hbLoading);
        const json = await loadHomebrewFile(path);
        setHb(h => ({ ...h, [path]: json }));
      }
      list.add(path);
    } else list.delete(path);
    saveSettings({ ...settings, homebrew: [...list] });
  }, [settings, hb, saveSettings, showToast, t]);

  const addHomebrewMany = useCallback(async (paths, on, onProgress) => {
    if (!on) {
      const rm = new Set(paths);
      saveSettings({ ...settings, homebrew: (settings.homebrew || []).filter(p => !rm.has(p)) });
      return;
    }
    const loaded = {}; let done = 0; let i = 0;
    const worker = async () => {
      while (i < paths.length) {
        const p = paths[i++];
        if (!hb[p]) { try { loaded[p] = await loadHomebrewFile(p); } catch (e) { console.warn('homebrew failed', p, e); } }
        onProgress && onProgress(++done, paths.length);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    setHb(h => ({ ...h, ...loaded }));
    const ok = paths.filter(p => hb[p] || loaded[p]);
    saveSettings({ ...settings, homebrew: [...new Set([...(settings.homebrew || []), ...ok])] });
  }, [settings, hb, saveSettings]);

  const addOwnHomebrew = useCallback(async (name, json) => {
    const path = 'local/' + name;
    setHb(h => ({ ...h, [path]: json }));
    saveSettings({ ...settings, homebrew: [...new Set([...(settings.homebrew || []), path])], localBrew: { ...(settings.localBrew || {}), [path]: json } });
  }, [settings, saveSettings]);
  useEffect(() => { // restore local homebrew files
    if (settings?.localBrew) setHb(h => ({ ...settings.localBrew, ...h }));
  }, [settings?.localBrew]);

  if (!settings || status.loading) {
    return (
      <LangCtx.Provider value={{ lang, t }}>
        <div className="loading"><div className="spinner" /><div className="bold">{t.loadingData}</div><div className="muted small">{status.msg}</div><div className="muted small">{t.loadingDataSub}</div></div>
      </LangCtx.Provider>
    );
  }
  const offline = !db;
  const needsData = (v) => ['sheet', 'wizard', 'levelup', 'sources'].includes(v);
  const noData = (
    <div className="page"><div className="card col" style={{ maxWidth: 640, margin: '40px auto', gap: 10, alignItems: 'flex-start' }}>
      <h2 className="serif" style={{ margin: 0 }}>{t.dataError}</h2>
      <span className="small">{t.offlineNeed}</span>
      {status.error && <span className="muted small">{status.error}</span>}
      <div className="row" style={{ gap: 8 }}>
        <button className="btn primary" onClick={() => loadAll()}>{t.retry}</button>
        <button className="btn" onClick={() => setView('designer')}>{t.tabDesigner}</button>
      </div>
    </div></div>
  );

  const ctx = { db, settings: charSettings, globalSettings: settings, saveSettings, ch, d, update, setView, showToast, createChar, openChar };
  const tabs = [['sheet', t.tabSheet], ['designer', t.tabDesigner], ['sound', t.tabSound], ['sources', t.tabSources], ['settings', t.tabSettings]];
  return (
    <LangCtx.Provider value={{ lang, t }}>
      <DbCtx.Provider value={db}>
      <div className="app">
        <header className="topbar">
          <div className="brand serif" title={t.appName}>{ch ? (ch.name || t.untitled) : t.appName}</div>
          <nav className="nav">
            {tabs.map(([k, l]) => <button key={k} className={view === k || (k === 'sheet' && (view === 'wizard' || view === 'levelup')) ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
          </nav>
          {[['paint', t.jobPaint, 'painter'], ['model3d', t.jobModel3d, 'trellis'], ['sound', t.jobSound, null]].map(([k, label, mode]) => jobs[k] && (
            <span key={k} className="jobchip" role="status">
              <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
              <button className="linklike" onClick={() => { if (!mode) { setView('sound'); return; } setView('designer'); if (ch && ch.id === jobs[k].charId) update(c => { c.designerMode = mode; return c; }); }}>
                {jobs[k].cancelling ? t.pCancelling : label} · {fmtTime(jobs[k].seconds)}
              </button>
              {(k === 'paint' || k === 'sound') && <span className={'jobbar' + (jobPct(jobs[k]) == null ? ' indet' : '')} title={jobPct(jobs[k]) == null ? t.progLoading : jobPct(jobs[k]) + ' %'}><i style={{ width: (jobPct(jobs[k]) ?? 30) + '%' }} /></span>}
              {(k === 'paint' || k === 'sound') && jobPct(jobs[k]) != null && <span style={{ minWidth: 30 }}>{jobPct(jobs[k])} %</span>}
              {!jobs[k].cancelling && <button className="jobx" aria-label={t.cancel} title={t.cancel} onClick={() => cancelJob(k)}>✕</button>}
            </span>
          ))}
          {jobs.done && !jobs.paint && !jobs.model3d && !jobs.sound && (
            <span className={'jobchip ' + (jobs.done.ok ? 'ok' : 'bad')} role="status">
              <button className="linklike" onClick={() => { if (jobs.done.kind === 'sound') { setView('sound'); dismissDone(); return; } setView('designer'); if (ch) update(c => { c.designerMode = jobs.done.kind === 'paint' ? 'painter' : 'trellis'; return c; }); dismissDone(); }}>
                {jobs.done.ok ? '✓ ' + (jobs.done.kind === 'paint' ? t.jobPaintDone : jobs.done.kind === 'sound' ? t.jobSoundDone : t.jobModelDone) : '✕ ' + t.jobFailed}{jobs.done.ok && jobs.done.seconds ? ' · ' + fmtTime(jobs.done.seconds) : ''}
              </button>
              <button className="jobx" aria-label={t.close} title={t.close} onClick={dismissDone}>✕</button>
            </span>
          )}          <div className="grow" />
          {['available', 'downloading', 'installing'].includes(upd.state) && (
            <button className="btn update-btn" onClick={() => setShowUpd(true)}
              title={upd.info ? t.updateAvail(upd.info.version) : ''} aria-label={upd.info ? t.updateAvail(upd.info.version) : 'Update'}>
              <span className="update-dot" />
              {upd.state === 'available' && <>Update <span className="small" style={{ opacity: .8 }}>v{upd.info?.version}</span></>}
              {upd.state === 'downloading' && <>Update {upd.pct} %</>}
              {upd.state === 'installing' && <>{t.updateRestartShort}</>}
            </button>
          )}
          <span className="pill">{(ch?.rules || settings.rules) === '2014' ? 'D&D 2014' : 'D&D 2024'}</span>
          <button className="btn" onClick={() => setShowChars(true)}>{t.myChars}</button>
          {ch && <span className="muted small autosaved" title={savedAt ? t.autosaved + ' · ' + savedAt.toLocaleTimeString(lang) : ''}>{savedAt ? t.autosaved + ' · ' + savedAt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
          {ch && <button className="btn primary" onClick={saveNow}>{t.save}</button>}
        </header>
        {driverWarn && (
          <div className="banner info" style={{ margin: '10px 22px 0' }}>
            <b>{t.driver}: {driverWarn.name}</b><span className="muted small">{driverWarn.driverDate?.slice(0, 10)} – {t.driverOld}. {t.driverNote}</span>
            <div className="grow" />
            <button className="btn sm" onClick={() => api.openExternal(AMD_DRIVER_URL)}>{t.driverLink}</button>
            <button className="btn sm ghost" onClick={() => setDriverWarn(null)}>{t.close}</button>
          </div>
        )}
        {offline && (
          <div className="banner" style={{ margin: '10px 22px 0' }}>
            <span className="small grow"><b>{t.offlineTitle}</b> · {t.offlineBanner}</span>
            <button className="btn sm" onClick={() => loadAll()}>{t.retry}</button>
          </div>
        )}
        <main className="main">
          <ErrorBoundary key={view} t={t} onReset={() => setView('sheet')}>
          {offline && needsData(view) && noData}
          {!offline && view === 'sheet' && <Sheet {...ctx} />}
          {!offline && view === 'wizard' && <Wizard {...ctx} />}
          {!offline && view === 'levelup' && <LevelUp {...ctx} />}
          {view === 'designer' && <Designer {...ctx} />}
          {view === 'sound' && <Sound {...ctx} />}
          {!offline && view === 'sources' && <Sources {...ctx} addHomebrew={addHomebrew} addHomebrewMany={addHomebrewMany} addOwnHomebrew={addOwnHomebrew} reload={() => loadAll(true)} hbLoaded={hb} />}
          {view === 'settings' && <Settings {...ctx} />}
          </ErrorBoundary>
        </main>
        {aiFirstRun && !status.loading && (
          <div className="modal-bg">
            <div className="modal" style={{ maxWidth: 680 }} role="dialog" aria-label={t.aiSetupTitle}>
              <h2 className="serif">{t.aiSetupTitle}</h2>
              <AiSetup onDone={() => setAiFirstRun(false)} onSkip={async () => { await api.ai.skip(); setAiFirstRun(false); }} />
            </div>
          </div>
        )}
        {showUpd && upd.info && <UpdateDialog u={upd} onClose={() => setShowUpd(false)} />}
        {showChars && <CharList {...ctx} onClose={() => setShowChars(false)} current={ch} setCh={setCh} />}
        {toast && <div className="toast">{toast}</div>}
        <DialogHost />
        <RefHost />
      </div>
      </DbCtx.Provider>
    </LangCtx.Provider>
  );
}
