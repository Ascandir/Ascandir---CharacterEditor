import React, { useMemo, useState } from 'react';
import { useT, ABIL_LONG, skillName } from '../i18n.js';
import { stripTags, dedupeByName, makeFilter } from '../engine/rules.js';
import { parseClassFeatureRef } from '../data/loader.js';
import Entries from './Entries.jsx';

const lc = s => String(s || '').toLowerCase();
const PB = n => 2 + Math.floor((n - 1) / 4);
const cap = s => String(s).replace(/^\w/, c => c.toUpperCase());

function cell(v) {
  if (v == null) return '—';
  if (typeof v === 'number') return v === 0 ? '—' : String(v);
  if (typeof v === 'string') return stripTags(v) || '—';
  switch (v.type) {
    case 'bonus': return (v.value >= 0 ? '+' : '') + v.value;
    case 'bonusSpeed': return (v.value >= 0 ? '+' : '') + v.value + ' ft.';
    case 'dice': return (v.toRoll || []).map(r => `${r.number}d${r.faces}`).join(' + ');
    case 'multiplier': return '×' + v.value;
    default: return v.value != null ? String(v.value) : '—';
  }
}

function profList(list) {
  return (list || []).map(x => {
    if (typeof x === 'string') return cap(stripTags(x.split('|')[0]));
    if (x.proficiency) return cap(stripTags(x.proficiency)) + (x.full ? ' (' + stripTags(x.full) + ')' : '');
    if (x.full) return stripTags(x.full);
    return '';
  }).filter(Boolean).join(', ');
}

// 5e.tools-like class overview: proficiencies, class table (incl. spell slots) and all features by level
export default function ClassInfo({ db, settings, cls, level = 1 }) {
  const { t, lang } = useT();
  const [openF, setOpenF] = useState({});
  const [showAll, setShowAll] = useState(false);
  const feats = useMemo(() => (cls.classFeatures || []).map(r => {
    const p = parseClassFeatureRef(r);
    const f = db.classFeatureMap.get([p.name, p.className, p.classSource, p.level, p.source].map(lc).join('|'));
    return { ...p, gainSub: typeof r === 'object' && r.gainSubclassFeature, entries: f?.entries };
  }), [cls, db]);
  const subs = useMemo(() => {
    const allowed = makeFilter(db, settings);
    return dedupeByName(db.subclasses.filter(s => lc(s.className) === lc(cls.name) && lc(s.classSource || 'PHB') === lc(cls.source) && allowed(s)), cls.source)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [cls, db, settings]);
  const sp = cls.startingProficiencies || {};
  const skillTxt = (sp.skills || []).map(s => {
    if (s.choose) return t.ciChoose(s.choose.count || 1) + ': ' + (s.choose.from || []).map(k => skillName(k, lang)).join(', ');
    if (s.any) return t.ciAnySkills(s.any);
    return Object.keys(s).map(k => skillName(k, lang)).join(', ');
  }).join('; ');
  const prim = (cls.primaryAbility || []).map(o => Object.keys(o).filter(k => o[k]).map(k => ABIL_LONG[lang][k] || k).join(' & ')).join(t.ciOr);
  const mc = cls.multiclassing || {};
  const mcReq = mc.requirements ? Object.entries(mc.requirements).map(([k, v]) => (k === 'or' ? v.map(o => Object.entries(o).map(([a, n]) => (ABIL_LONG[lang][a] || a) + ' ' + n).join(t.ciOr)).join('; ') : (ABIL_LONG[lang][k] || k) + ' ' + v)).join(', ') : null;
  const facts = [
    [t.ciHitDie, `d${cls.hd?.faces} ${t.ciPerLevel} · ${t.ciHp1}: ${cls.hd?.faces} + ${ABIL_LONG[lang].con} · ${t.ciHpUp}: ${(cls.hd?.faces || 8) / 2 + 1} + ${ABIL_LONG[lang].con}`],
    [t.ciPrimary, prim || '—'],
    [t.ciSaves, (cls.proficiency || []).map(a => ABIL_LONG[lang][a] || a).join(', ')],
    [t.ciArmor, profList(sp.armor) || t.none],
    [t.ciWeapons, profList(sp.weapons) || t.none],
    sp.tools?.length ? [t.ciTools, profList(sp.tools)] : null,
    [t.ciSkills, skillTxt || t.none],
    cls.spellcastingAbility ? [t.ciCasting, `${ABIL_LONG[lang][cls.spellcastingAbility]} · ${{ full: t.fFull, '1/2': t.fHalf, '1/3': t.fThird, pact: t.fPact }[cls.casterProgression] || cls.casterProgression || ''}`] : null,
    mcReq ? [t.ciMulti, mcReq + (mc.proficienciesGained ? ' · ' + t.ciGains + ': ' + [profList(mc.proficienciesGained.armor), profList(mc.proficienciesGained.weapons), (mc.proficienciesGained.skills || []).map(s => (s.choose ? t.ciChoose(s.choose.count || 1) + ' ' + (s.choose.from || []).map(k => skillName(k, lang)).join('/') : '')).join('')].filter(Boolean).join(', ') : '')] : null,
  ].filter(Boolean);

  const groups = cls.classTableGroups || [];
  const featsAt = n => feats.filter(f => f.level === n);
  const toggle = (key, on) => setOpenF(o => ({ ...o, [key]: on ?? !o[key] }));
  const jump = (f) => { const key = f.name + '|' + f.level; toggle(key, true); setTimeout(() => document.getElementById('cf-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 30); };

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card">
        <div className="grid" style={{ gridTemplateColumns: 'minmax(140px, max-content) 1fr', gap: '6px 16px' }}>
          {facts.map(([k, v]) => <React.Fragment key={k}><span className="muted small bold">{k}</span><span className="small">{v}</span></React.Fragment>)}
        </div>
        {cls.startingEquipment?.entries && (
          <div style={{ marginTop: 10 }}><span className="muted small bold">{t.ciEquip}</span><Entries entries={cls.startingEquipment.entries} /></div>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{t.ciTable(cls.name)}</h3>
        <table className="classtable">
          <thead>
            <tr>
              <th colSpan={3} />
              {groups.map((g, gi) => <th key={gi} colSpan={(g.colLabels || []).length} className="grp">{g.title ? stripTags(g.title) : ''}</th>)}
            </tr>
            <tr>
              <th>{t.level}</th><th>{t.ciPB}</th><th style={{ textAlign: 'left' }}>{t.ciFeatures}</th>
              {groups.flatMap((g, gi) => (g.colLabels || []).map((c, ci) => <th key={gi + '-' + ci}>{stripTags(c)}</th>))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 20 }, (_, i) => i + 1).map(n => (
              <tr key={n} className={n === level ? 'cur' : n < level ? 'past' : ''}>
                <td>{n}</td><td>+{PB(n)}</td>
                <td style={{ textAlign: 'left' }}>
                  {featsAt(n).map((f, i) => <React.Fragment key={i}>{i > 0 && ', '}<span className="reflink" role="button" tabIndex={0} onClick={() => jump(f)}>{f.name}</span></React.Fragment>)}
                </td>
                {groups.flatMap((g, gi) => ((g.rows || g.rowsSpellProgression || [])[n - 1] || []).map((v, ci) => <td key={gi + '-' + ci}>{cell(v)}</td>))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card col" style={{ gap: 6 }}>
        <div className="row"><h3 style={{ margin: 0 }} className="grow">{t.ciFeatures}</h3>
          <button className="btn sm" onClick={() => setShowAll(!showAll)}>{showAll ? t.ciUpToLevel(level) : t.ciAllLevels}</button>
          <button className="btn sm ghost" onClick={() => { const all = {}; feats.forEach(f => { all[f.name + '|' + f.level] = !Object.values(openF).some(Boolean); }); setOpenF(all); }}>{t.ciToggleAll}</button>
        </div>
        {feats.filter(f => showAll || f.level <= level).map(f => {
          const key = f.name + '|' + f.level; const open = !!openF[key];
          return (
            <div key={key} id={'cf-' + key} className="featrow">
              <button className="collapse-head" onClick={() => toggle(key)} aria-expanded={open}>
                <span className="pill">{t.level} {f.level}</span><b>{f.name}</b><span className="grow" /><span className="chev">{open ? '▾' : '▸'}</span>
              </button>
              {open && <div style={{ padding: '6px 4px 10px' }}>{f.entries ? <Entries entries={f.entries} /> : <span className="muted small">—</span>}</div>}
            </div>
          );
        })}
      </div>

      {subs.length > 0 && (
        <div className="card col" style={{ gap: 8 }}>
          <h3 style={{ margin: 0 }}>{cls.subclassTitle || t.ciSubclasses}</h3>
          <div className="row wrap" style={{ gap: 6 }}>{subs.map(s => <span key={s.name + s.source} className="chip" title={db.sourceMeta[s.source]?.name || s.source}>{s.name} <span className="muted">{db.sourceMeta[s.source]?.abbr || s.source}</span></span>)}</div>
        </div>
      )}
    </div>
  );
}
