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
import CharList from './views/CharList.jsx';
import { primaryGpu, AMD_DRIVER_URL } from './hardware.js';

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
      const off = await loadOfficial(m => setStatus(st => ({ ...st, msg: m })), force);
      const hbData = {};
      for (const p of s.homebrew || []) {
        try { hbData[p] = await loadHomebrewFile(p, force); } catch (e) { console.warn('homebrew failed', p, e); }
      }
      setHb(hbData);
      setOfficial(off);
      if (s.lastCharId) {
        try { const c = await api.loadChar(s.lastCharId); if (c) setCh(c); } catch { /* ignore */ }
      }
      setStatus({ loading: false, msg: '', error: null });
    } catch (e) {
      setStatus({ loading: false, msg: '', error: String(e.message || e) });
    }
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);
  const [driverWarn, setDriverWarn] = useState(null);
  useEffect(() => { api.hardware().then(info => { const g = primaryGpu(info); if (g?.status === 'old') setDriverWarn(g); }).catch(() => {}); }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

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
    setView('wizard'); setShowChars(false);
  }, [settings, saveSettings]);

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
  if (status.error || !db) {
    return (
      <LangCtx.Provider value={{ lang, t }}>
        <div className="loading"><div className="bold">{t.dataError}</div><div className="muted small">{status.error}</div><button className="btn primary" onClick={() => loadAll()}>{t.retry}</button></div>
      </LangCtx.Provider>
    );
  }

  const ctx = { db, settings: charSettings, globalSettings: settings, saveSettings, ch, d, update, setView, showToast, createChar, openChar };
  const tabs = [['sheet', t.tabSheet], ['designer', t.tabDesigner], ['sources', t.tabSources], ['settings', t.tabSettings]];
  return (
    <LangCtx.Provider value={{ lang, t }}>
      <div className="app">
        <header className="topbar">
          <div className="brand serif">{t.appName}</div>
          <nav className="nav">
            {tabs.map(([k, l]) => <button key={k} className={view === k || (k === 'sheet' && (view === 'wizard' || view === 'levelup')) ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
          </nav>
          <div className="grow" />
          <span className="pill">{(ch?.rules || settings.rules) === '2014' ? 'D&D 2014' : 'D&D 2024'}</span>
          <button className="btn" onClick={() => setShowChars(true)}>{t.myChars}</button>
          {ch && <span className="muted small">{savedAt ? t.autosaved + ' · ' + savedAt.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' }) : ''}</span>}
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
        <main className="main">
          {view === 'sheet' && <Sheet {...ctx} />}
          {view === 'wizard' && <Wizard {...ctx} />}
          {view === 'levelup' && <LevelUp {...ctx} />}
          {view === 'designer' && <Designer {...ctx} />}
          {view === 'sources' && <Sources {...ctx} addHomebrew={addHomebrew} addHomebrewMany={addHomebrewMany} addOwnHomebrew={addOwnHomebrew} reload={() => loadAll(true)} hbLoaded={hb} />}
          {view === 'settings' && <Settings {...ctx} />}
        </main>
        {showChars && <CharList {...ctx} onClose={() => setShowChars(false)} current={ch} setCh={setCh} />}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </LangCtx.Provider>
  );
}
