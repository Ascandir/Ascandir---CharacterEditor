import React, { createContext, useContext, useEffect, useState } from 'react';
import { stripTags } from '../engine/rules.js';

// ---- clickable references ({@feat ...}, {@spell ...}, {@item ...}, ...) ----
export const DbCtx = createContext(null);
const LINK_KINDS = { feat: 'feat', spell: 'spell', item: 'item', optfeature: 'optionalfeature', background: 'background', race: 'race' };
const DEFAULT_SRC = { feat: ['XPHB', 'PHB'], spell: ['XPHB', 'PHB'], item: ['XPHB', 'PHB', 'DMG', 'XDMG'], optionalfeature: ['XPHB', 'PHB'], background: ['XPHB', 'PHB'], race: ['XPHB', 'PHB'] };
let openRef = null;
export function findEntity(db, kind, name, src) {
  const map = db?.byUid?.[kind]; if (!map) return null;
  const n = String(name).split(';')[0].trim().toLowerCase();
  if (src) { const e = map.get(n + '|' + src.toLowerCase()); if (e) return e; }
  for (const s of DEFAULT_SRC[kind] || []) { const e = map.get(n + '|' + s.toLowerCase()); if (e) return e; }
  for (const [k, e] of map) if (k.startsWith(n + '|')) return e;
  return null;
}
function Rich({ text }) {
  if (typeof text !== 'string') return text ?? null;
  const out = []; let last = 0; let m;
  const re = /\{@(\w+)\s+([^{}]*?)\}/g;
  while ((m = re.exec(text))) {
    const kind = LINK_KINDS[m[1]];
    if (!kind) continue;
    if (m.index > last) out.push(stripTags(text.slice(last, m.index)));
    const p = m[2].split('|');
    const label = p[2] || p[0].split(';').map((x, i) => (i ? ' (' + x.trim() + ')' : x)).join('');
    const nm = p[0], src = p[1];
    out.push(<span key={m.index} className="reflink" role="button" tabIndex={0} onClick={() => openRef?.(kind, nm, src)} onKeyDown={e => { if (e.key === 'Enter') openRef?.(kind, nm, src); }}>{stripTags(label)}</span>);
    last = m.index + m[0].length;
  }
  if (!out.length) return stripTags(text);
  if (last < text.length) out.push(stripTags(text.slice(last)));
  return <>{out}</>;
}

export function RefHost() {
  const db = useContext(DbCtx);
  const [stack, setStack] = useState([]);
  useEffect(() => { openRef = (kind, name, src) => { const e = findEntity(db, kind, name, src); setStack(s => [...s, { kind, name, e }]); }; return () => { openRef = null; }; }, [db]);
  if (!stack.length) return null;
  const top = stack[stack.length - 1];
  const close = () => setStack(s => s.slice(0, -1));
  const e = top.e;
  return (
    <div className="modal-bg" style={{ zIndex: 70 }} onClick={() => setStack([])}>
      <div className="modal" style={{ maxWidth: 620, maxHeight: '80vh', overflowY: 'auto' }} onClick={ev => ev.stopPropagation()} role="dialog" aria-modal="true" onKeyDown={ev => { if (ev.key === 'Escape') close(); }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
          <h2 className="serif" style={{ margin: 0 }}>{e?.name || top.name}</h2>
          <span className="muted small">{e?.source}{e && top.kind === 'spell' ? ' · ' + spellMeta(e) : ''}</span>
        </div>
        {e?.prerequisite && <div className="muted small">Prerequisite: {prereqText(e.prerequisite)}</div>}
        {e ? <Entries entries={e.entries} /> : <p className="muted">—</p>}
        {e?.entriesHigherLevel && <Entries entries={e.entriesHigherLevel} />}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {stack.length > 1 && <button className="btn ghost" onClick={close}>←</button>}
          <button className="btn primary" autoFocus onClick={() => setStack([])}>OK</button>
        </div>
      </div>
    </div>
  );
}
function prereqText(pr) {
  return [].concat(pr).map(p => Object.entries(p).map(([k, v]) => k === 'level' ? 'Level ' + (v.level ?? v) : k === 'ability' ? [].concat(v).map(a => Object.entries(a).map(([x, y]) => x.toUpperCase() + ' ' + y).join('/')).join(' or ') : k === 'feat' ? [].concat(v).map(f => String(f).split('|')[0]).join(', ') : k === 'spellcasting' || k === 'spellcasting2020' ? 'Spellcasting' : k === 'other' ? v : k).join(', ')).join('; ');
}

function RefEntry({ e, depth }) {
  const db = useContext(DbCtx);
  const ref = String(e.classFeature || e.subclassFeature || e.optionalfeature || '');
  const p = ref.split('|');
  let ent = null;
  if (db) {
    if (e.type === 'refClassFeature') ent = db.classFeatureMap?.get([p[0], p[1], p[2] || 'PHB', p[3], p[4] || p[2] || 'PHB'].map(x => String(x).toLowerCase()).join('|'));
    else if (e.type === 'refSubclassFeature') ent = db.subclassFeatureMap?.get([p[0], p[1], p[2] || 'PHB', p[3], p[4] || 'PHB', p[5], p[6] || p[4] || 'PHB'].map(x => String(x).toLowerCase()).join('|'));
    else ent = findEntity(db, 'optionalfeature', p[0], p[1]);
  }
  return (
    <div style={{ marginLeft: depth ? 8 : 0 }}>
      <p><b>{p[0]}</b></p>
      {ent?.entries && <Entry e={ent.entries} depth={depth + 1} />}
    </div>
  );
}

function Entry({ e, depth }) {
  if (e == null) return null;
  if (typeof e === 'string') return <p><Rich text={e} /></p>;
  if (Array.isArray(e)) return e.map((x, i) => <Entry key={i} e={x} depth={depth} />);
  switch (e.type) {
    case 'list':
      return <ul>{(e.items || []).map((it, i) => <li key={i}>{typeof it === 'string' ? <Rich text={it} /> : <>{it.name && <b>{stripTags(it.name)} </b>}{it.entry ? <Rich text={it.entry} /> : <Entry e={it.entries} depth={depth + 1} />}</>}</li>)}</ul>;
    case 'table':
      return (
        <table>
          {e.colLabels && <thead><tr>{e.colLabels.map((c, i) => <th key={i}>{stripTags(c)}</th>)}</tr></thead>}
          <tbody>{(e.rows || []).map((r, i) => <tr key={i}>{(Array.isArray(r) ? r : r.row || []).map((c, j) => <td key={j}>{typeof c === 'string' || typeof c === 'number' ? stripTags(String(c)) : stripTags(c?.roll ? `${c.roll.min ?? c.roll.exact}${c.roll.max ? '–' + c.roll.max : ''}` : (c?.entry || ''))}</td>)}</tr>)}</tbody>
        </table>
      );
    case 'item':
      return <p>{e.name && <b>{stripTags(e.name)} </b>}{e.entry ? <Rich text={e.entry} /> : null}{e.entries ? <Entry e={e.entries} depth={depth + 1} /> : null}</p>;
    case 'refClassFeature': case 'refSubclassFeature': case 'refOptionalfeature':
      return <RefEntry e={e} depth={depth} />;
    case 'quote':
      return <p><i>{(e.entries || []).map(stripTags).join(' ')}</i></p>;
    default:
      if (e.entries || e.entry) {
        return (
          <div style={{ marginLeft: depth ? 8 : 0 }}>
            {e.name && <p><b>{stripTags(e.name)}</b></p>}
            <Entry e={e.entries || e.entry} depth={depth + 1} />
          </div>
        );
      }
      return e.name ? <p><b>{stripTags(e.name)}</b></p> : null;
  }
}

export default function Entries({ entries }) {
  if (!entries) return null;
  return <div className="entries"><Entry e={entries} depth={0} /></div>;
}

export function spellMeta(s) {
  const lvl = s.level === 0 ? 'Cantrip' : 'Level ' + s.level;
  const school = { A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment', V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation' }[s.school] || s.school;
  const time = (s.time || []).map(t => `${t.number} ${t.unit}`).join(', ');
  const range = s.range?.distance ? `${s.range.distance.amount ?? ''} ${s.range.distance.type}` : s.range?.type || '';
  const dur = (s.duration || []).map(d => d.type === 'timed' ? `${d.concentration ? 'Conc., ' : ''}${d.duration.amount} ${d.duration.type}` : d.type).join(', ');
  return [lvl, school, time, range, dur].filter(Boolean).join(' · ');
}
