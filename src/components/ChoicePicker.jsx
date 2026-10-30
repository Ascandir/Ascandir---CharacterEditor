import React, { useMemo, useState } from 'react';
import { useT, ABILS, ABIL_LONG, skillName } from '../i18n.js';
import { isComplete, featPrereqText } from '../engine/rules.js';
import Entries, { spellMeta } from './Entries.jsx';

function optLabel(c, o, lang) {
  if (c.kind === 'skill') return skillName(o.value, lang);
  if (c.kind === 'abil') return ABIL_LONG[lang][o.value] || o.value;
  return o.label;
}

function summary(c, lang) {
  const v = c.value;
  if (Array.isArray(v)) return v.map(x => { const o = (c.options || []).find(o => o.value === x); return o ? optLabel(c, o, lang) : x; }).join(', ');
  if (c.kind === 'text') return v || '';
  if (c.kind === 'asiFeat' && v) {
    if (v.mode === 'feat') return (c.featOptions || []).find(o => o.value === v.feat)?.label || '';
    return (v.abil || []).filter(Boolean).map(a => ABIL_LONG[lang][a] + (v.mode === 'asi2' ? ' +2' : ' +1')).join(', ');
  }
  if ((c.kind === 'weighted' || c.kind === 'flexAsi') && v?.abil) return v.abil.filter(Boolean).map(a => ABIL_LONG[lang][a]).join(', ');
  return '';
}

export default function ChoicePicker({ c, onChange, scores, totalLevel }) {
  const { t, lang } = useT();
  const done = isComplete(c);
  const [open, setOpen] = useState(!done);
  return (
    <div className="card" style={{ borderColor: done ? 'var(--line)' : 'var(--warnline)' }}>
      <button className="collapse-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {!done && <span className="tag req">{t.required}</span>}
        {done && <span className="tag" style={{ background: 'var(--okbg)', color: '#b8e6c6' }}>✓ {t.chosen}</span>}
        <h3 style={{ margin: 0 }}>{c.label}</h3>
        {c.level && <span className="muted small">{t.level} {c.level}</span>}
        {!open && done && <span className="muted small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>{summary(c, lang)}</span>}
        <span className="grow" />
        {c.count > 1 && ['pick', 'skill', 'abil', 'feat', 'lang'].includes(c.kind) && <span className="muted small">{(c.value || []).length} / {c.count}</span>}
        <span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}><Body c={c} onChange={onChange} scores={scores} totalLevel={totalLevel} t={t} lang={lang} /></div>}
    </div>
  );
}

function Body({ c, onChange, scores, totalLevel, t, lang }) {
  switch (c.kind) {
    case 'pick': case 'skill': case 'abil': case 'feat': case 'lang':
      return <MultiPick c={c} onChange={onChange} t={t} lang={lang} scores={scores} totalLevel={totalLevel} />;
    case 'weighted': return <Weighted c={c} onChange={onChange} t={t} lang={lang} />;
    case 'flexAsi': return <FlexAsi c={c} onChange={onChange} t={t} lang={lang} />;
    case 'asiFeat': return <AsiFeat c={c} onChange={onChange} t={t} lang={lang} scores={scores} totalLevel={totalLevel} />;
    case 'text':
      return (
        <div className="col">
          <span className="muted small">{t.ruleNotAuto}</span>
          <input aria-label={c.label} value={c.value || ''} onChange={e => onChange(e.target.value)} />
        </div>
      );
    default: return null;
  }
}

function MultiPick({ c, onChange, t, lang, scores, totalLevel }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const val = c.value || [];
  const many = (c.options || []).length > 14;
  const opts = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (c.options || []).filter(o => !s || optLabel(c, o, lang).toLowerCase().includes(s));
  }, [c.options, q, lang]);
  const toggle = (v) => {
    if ((c.count || 1) === 1) return onChange(val[0] === v ? [] : [v]);
    if (val.includes(v)) return onChange(val.filter(x => x !== v));
    if (val.length >= c.count) return onChange([...val.slice(1), v]);
    onChange([...val, v]);
  };
  const detail = open && (c.options || []).find(o => o.value === open);
  const grouped = c.spell ? groupBy(opts, o => o.spellLevel) : null;
  const renderOpt = (o) => {
    const sel = val.includes(o.value);
    const prereq = o.prereq || (o.entity && c.kind === 'feat' ? featPrereqText(o.entity) : '');
    return (
      <button key={o.value} className={'opt' + (sel ? ' sel' : '') + (o.unmet && !sel ? ' unmet' : '')} disabled={o.unmet && !sel} title={o.unmet ? prereq : undefined} onClick={() => { toggle(o.value); if (o.entity) setOpen(o.value); }} aria-pressed={sel}>
        <span style={{ fontWeight: 600 }}>{optLabel(c, o, lang)}</span>
        {(o.src || prereq) && <span className="s">{[o.src, prereq].filter(Boolean).join(' · ')}</span>}
      </button>
    );
  };
  return (
    <div className="col">
      {many && <input placeholder={t.search} value={q} onChange={e => setQ(e.target.value)} aria-label={t.search} />}
      {val.length > 0 && many && (
        <div className="row">{val.map(v => { const o = c.options.find(x => x.value === v); return <button key={v} className="chip on" onClick={() => toggle(v)}>{o ? optLabel(c, o, lang) : v} ✕</button>; })}</div>
      )}
      <div className={many ? 'scroll' : ''}>
        {grouped ? Object.entries(grouped).map(([lvl, list]) => (
          <div key={lvl} style={{ marginBottom: 10 }}>
            <div className="muted small bold" style={{ margin: '4px 0 6px' }}>{lvl === '0' ? t.cantrips : t.level + ' ' + lvl}</div>
            <div className="optgrid">{list.map(renderOpt)}</div>
          </div>
        )) : <div className="optgrid">{opts.map(renderOpt)}</div>}
      </div>
      {detail?.entity && (
        <div className="feat">
          <div className="row"><b>{detail.label}</b><span className="muted small">{detail.entity.level != null && detail.entity.school ? spellMeta(detail.entity) : detail.src}</span>
            <div className="grow" /><button className="btn sm ghost" onClick={() => setOpen(null)}>{t.hideInfo}</button></div>
          <Entries entries={detail.entity.entries} />
        </div>
      )}
    </div>
  );
}

function groupBy(list, fn) {
  const o = {};
  for (const x of list) (o[fn(x)] = o[fn(x)] || []).push(x);
  return o;
}

function AbilSelect({ value, onChange, from, exclude, lang, label }) {
  return (
    <select aria-label={label} value={value || ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">—</option>
      {(from || ABILS).map(a => <option key={a} value={a} disabled={exclude?.includes(a) && a !== value}>{ABIL_LONG[lang][a]}</option>)}
    </select>
  );
}

function Weighted({ c, onChange, t, lang }) {
  const v = c.value || { mode: null, abil: [] };
  return (
    <div className="col">
      <div className="seg" role="group">
        {c.modes.map((m, i) => <button key={i} className={v.mode === i ? 'on' : ''} onClick={() => onChange({ mode: i, abil: [] })}>{m.map(x => '+' + x).join(' / ')}</button>)}
      </div>
      {v.mode != null && (
        <div className="row">
          {c.modes[v.mode].map((w, i) => (
            <label key={i} className="row" style={{ gap: 6 }}>
              <span className="bold">+{w}</span>
              <AbilSelect label={'+' + w} lang={lang} from={c.from} value={v.abil[i]} exclude={v.abil}
                onChange={a => { const ab = [...v.abil]; ab[i] = a; onChange({ ...v, abil: ab }); }} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FlexAsi({ c, onChange, t, lang }) {
  const v = c.value || { mode: '21', abil: [] };
  const ws = v.mode === '111' ? [1, 1, 1] : [2, 1];
  return (
    <div className="col">
      <div className="seg">
        <button className={v.mode !== '111' ? 'on' : ''} onClick={() => onChange({ mode: '21', abil: [] })}>+2 / +1</button>
        <button className={v.mode === '111' ? 'on' : ''} onClick={() => onChange({ mode: '111', abil: [] })}>+1 / +1 / +1</button>
      </div>
      <div className="row">
        {ws.map((w, i) => (
          <label key={i} className="row" style={{ gap: 6 }}><span className="bold">+{w}</span>
            <AbilSelect label={'+' + w} lang={lang} value={v.abil?.[i]} exclude={v.abil} onChange={a => { const ab = [...(v.abil || [])]; ab[i] = a; onChange({ ...v, abil: ab }); }} />
          </label>
        ))}
      </div>
    </div>
  );
}

function AsiFeat({ c, onChange, t, lang, scores, totalLevel }) {
  const v = c.value || {};
  const [q, setQ] = useState('');
  const opts = (c.featOptions || []).filter(o => !q || o.label.toLowerCase().includes(q.toLowerCase()));
  const sel = v.feat && c.featOptions.find(o => o.value === v.feat);
  return (
    <div className="col">
      <div className="seg">
        <button className={v.mode === 'asi2' ? 'on' : ''} onClick={() => onChange({ mode: 'asi2', abil: [] })}>{t.plus2}</button>
        <button className={v.mode === 'asi11' ? 'on' : ''} onClick={() => onChange({ mode: 'asi11', abil: [] })}>{t.plus1x2}</button>
        <button className={v.mode === 'feat' ? 'on' : ''} onClick={() => onChange({ mode: 'feat' })}>{t.feat}</button>
      </div>
      {v.mode === 'asi2' && <AbilSelect label={t.plus2} lang={lang} value={v.abil?.[0]} onChange={a => onChange({ ...v, abil: [a] })} />}
      {v.mode === 'asi11' && (
        <div className="row">
          {[0, 1].map(i => <AbilSelect key={i} label={t.plus1x2} lang={lang} value={v.abil?.[i]} exclude={v.abil} onChange={a => { const ab = [...(v.abil || [])]; ab[i] = a; onChange({ ...v, abil: ab }); }} />)}
        </div>
      )}
      {v.mode === 'feat' && (
        <>
          <input placeholder={t.search} value={q} onChange={e => setQ(e.target.value)} aria-label={t.search} />
          <div className="scroll"><div className="optgrid">
            {opts.map(o => (
              <button key={o.value} className={'opt' + (v.feat === o.value ? ' sel' : '')} onClick={() => onChange({ mode: 'feat', feat: o.value })}>
                <span style={{ fontWeight: 600 }}>{o.label}</span>
                <span className="s">{[o.src, o.prereq].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
          </div></div>
          {sel && <div className="feat"><b>{sel.label}</b><Entries entries={sel.entity.entries} /></div>}
        </>
      )}
    </div>
  );
}
