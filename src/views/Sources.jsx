import React, { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n.js';
import { api } from '../platform.js';
import { loadHomebrewIndex, sourceGroup } from '../data/loader.js';

export default function Sources({ db, globalSettings: s, saveSettings, addHomebrew, addOwnHomebrew, reload, ch, update, showToast }) {
  const { t } = useT();
  const [hbIndex, setHbIndex] = useState(null);
  const [hbErr, setHbErr] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(null);
  useEffect(() => { loadHomebrewIndex().then(setHbIndex).catch(e => setHbErr(String(e.message || e))); }, []);
  const disabled = new Set(s.disabledSources || []);
  const groups = useMemo(() => {
    const g = { core: [], supplement: [], setting: [], other: [] };
    for (const src of Object.keys(db.sourceCounts)) {
      const grp = sourceGroup(db, src);
      if (grp === 'homebrew') continue;
      g[grp].push({ src, name: db.sourceMeta[src]?.name || src, count: db.sourceCounts[src] });
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.name.localeCompare(b.name));
    return g;
  }, [db]);
  const setDisabled = (list) => saveSettings({ ...s, disabledSources: [...new Set(list)] });
  const toggle = (src) => { const n = new Set(disabled); n.has(src) ? n.delete(src) : n.add(src); setDisabled([...n]); };
  const hbShown = useMemo(() => {
    if (!hbIndex) return [];
    const term = q.trim().toLowerCase();
    const act = new Set(s.homebrew || []);
    const list = hbIndex.filter(h => !term || h.title.toLowerCase().includes(term));
    return [...list.filter(h => act.has(h.path)), ...list.filter(h => !act.has(h.path)).slice(0, 80)];
  }, [hbIndex, q, s.homebrew]);
  const profiles = s.profiles || {};
  const saveProfile = () => {
    const name = window.prompt(t.srcProfile, s.activeProfile || 'Standard');
    if (!name) return;
    saveSettings({ ...s, activeProfile: name, profiles: { ...profiles, [name]: { rules: s.rules, disabledSources: s.disabledSources || [], homebrew: s.homebrew || [] } } });
  };
  const loadProfile = (name) => {
    const p = profiles[name];
    if (!p) return saveSettings({ ...s, activeProfile: name });
    saveSettings({ ...s, activeProfile: name, rules: p.rules, disabledSources: p.disabledSources, homebrew: p.homebrew });
    (p.homebrew || []).forEach(h => addHomebrew(h, true));
  };
  const exportProfile = () => api.saveFile({ defaultName: (s.activeProfile || 'profil') + '.ace-profile.json', filters: [{ name: 'JSON', extensions: ['json'] }],
    text: JSON.stringify({ aceProfile: 1, name: s.activeProfile, rules: s.rules, disabledSources: s.disabledSources || [], homebrew: (s.homebrew || []).filter(h => !h.startsWith('local/')) }, null, 2) });
  const importProfile = async () => {
    const f = await api.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!f) return;
    try {
      const p = JSON.parse(f.text);
      if (!p.aceProfile) throw new Error();
      const name = p.name || 'Import';
      saveSettings({ ...s, activeProfile: name, rules: p.rules, disabledSources: p.disabledSources || [], homebrew: p.homebrew || [], profiles: { ...profiles, [name]: { rules: p.rules, disabledSources: p.disabledSources || [], homebrew: p.homebrew || [] } } });
      for (const h of p.homebrew || []) await addHomebrew(h, true);
    } catch { showToast('Import failed'); }
  };
  const loadOwn = async () => {
    const f = await api.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!f) return;
    try { await addOwnHomebrew(f.name, JSON.parse(f.text)); } catch { showToast('Invalid JSON'); }
  };
  const label = { core: t.srcCore, supplement: t.srcSupplement, setting: t.srcSetting, other: t.srcAdventure };
  return (
    <div className="page">
      <section className="col" style={{ flex: '1 1 300px', maxWidth: 400 }}>
        <div className="card col">
          <label className="col" style={{ gap: 6 }}><span className="bold">{t.srcProfile}</span>
            <select value={s.activeProfile || 'Standard'} onChange={e => loadProfile(e.target.value)}>
              {[...new Set(['Standard', ...Object.keys(profiles), s.activeProfile || 'Standard'])].map(n => <option key={n} value={n}>{n}</option>)}
            </select></label>
          <div className="row">
            <button className="btn sm" onClick={saveProfile}>{t.save}</button>
            <button className="btn sm" onClick={exportProfile}>{t.export}</button>
            <button className="btn sm" onClick={importProfile}>{t.import}</button>
          </div>
        </div>
        <div className="card col">
          <span className="bold">{t.rulesVersion}</span>
          {['2024', '2014'].map(r => (
            <button key={r} className={'opt' + (s.rules === r ? ' sel' : '')} onClick={() => saveSettings({ ...s, rules: r })}>
              <span className="bold">D&D {r}</span><span className="s">{r === '2024' ? t.rules2024 : t.rules2014}</span>
            </button>
          ))}
          {ch && ch.rules !== s.rules && <span className="muted small">{ch.name || t.untitled}: D&D {ch.rules} ({t.steps[0]})</span>}
        </div>
        <div className="card col">
          <button className="btn" onClick={reload}>{t.dataUpdate}</button>
        </div>
      </section>

      <section className="col" style={{ flex: '999 1 560px', minWidth: 0 }}>
        {Object.entries(groups).map(([k, list]) => list.length > 0 && (
          <div key={k} className="card">
            <div className="row" style={{ marginBottom: 10 }}>
              <h3 className="grow" style={{ margin: 0 }}>{label[k]}</h3>
              <span className="muted small">{t.activeOf(list.filter(x => !disabled.has(x.src)).length, list.length)}</span>
              <button className="btn sm" onClick={() => setDisabled([...disabled].filter(x => !list.some(l => l.src === x)))}>{t.allOn}</button>
              <button className="btn sm" onClick={() => setDisabled([...disabled, ...list.map(l => l.src)])}>{t.allOff}</button>
            </div>
            <div className="grid g2">
              {list.map(x => (
                <label key={x.src} className="listbtn" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={!disabled.has(x.src)} onChange={() => toggle(x.src)} />
                  <span className="grow">{x.name}</span><span className="muted small">{x.src}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="card col">
          <div className="row">
            <h3 className="grow" style={{ margin: 0 }}>{t.srcHomebrew}</h3>
            <button className="btn sm" onClick={loadOwn}>{t.loadOwnFile}</button>
          </div>
          <input placeholder={t.srcHomebrewSearch} value={q} onChange={e => setQ(e.target.value)} aria-label={t.srcHomebrewSearch} />
          {hbErr && <div className="muted small">{hbErr}</div>}
          {!hbIndex && !hbErr && <div className="muted small">{t.hbLoading}</div>}
          {(s.homebrew || []).filter(h => h.startsWith('local/')).map(h => (
            <label key={h} className="listbtn sel"><input type="checkbox" checked onChange={() => addHomebrew(h, false)} /><span className="bold grow">{h.replace('local/', '')}</span><span className="muted small">lokal</span></label>
          ))}
          <div className="col scroll" style={{ gap: 6, maxHeight: 480 }}>
            {hbShown.map(h => {
              const on = (s.homebrew || []).includes(h.path);
              return (
                <label key={h.path} className={'listbtn' + (on ? ' sel' : '')} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} disabled={busy === h.path} onChange={async () => { setBusy(h.path); try { await addHomebrew(h.path, !on); } catch (e) { showToast(String(e.message || e)); } setBusy(null); }} />
                  <span className="grow"><span className="bold">{h.title}</span></span>
                  <span className="muted small">{h.props.slice(0, 3).join(', ')}</span>
                </label>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
