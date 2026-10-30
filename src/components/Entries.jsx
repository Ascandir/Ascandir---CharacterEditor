import React from 'react';
import { stripTags } from '../engine/rules.js';

function Entry({ e, depth }) {
  if (e == null) return null;
  if (typeof e === 'string') return <p>{stripTags(e)}</p>;
  if (Array.isArray(e)) return e.map((x, i) => <Entry key={i} e={x} depth={depth} />);
  switch (e.type) {
    case 'list':
      return <ul>{(e.items || []).map((it, i) => <li key={i}>{typeof it === 'string' ? stripTags(it) : <>{it.name && <b>{stripTags(it.name)} </b>}{it.entry ? stripTags(it.entry) : <Entry e={it.entries} depth={depth + 1} />}</>}</li>)}</ul>;
    case 'table':
      return (
        <table>
          {e.colLabels && <thead><tr>{e.colLabels.map((c, i) => <th key={i}>{stripTags(c)}</th>)}</tr></thead>}
          <tbody>{(e.rows || []).map((r, i) => <tr key={i}>{(Array.isArray(r) ? r : r.row || []).map((c, j) => <td key={j}>{typeof c === 'string' || typeof c === 'number' ? stripTags(String(c)) : stripTags(c?.roll ? `${c.roll.min ?? c.roll.exact}${c.roll.max ? '–' + c.roll.max : ''}` : (c?.entry || ''))}</td>)}</tr>)}</tbody>
        </table>
      );
    case 'item':
      return <p>{e.name && <b>{stripTags(e.name)} </b>}{e.entry ? stripTags(e.entry) : null}</p>;
    case 'refClassFeature': case 'refSubclassFeature': case 'refOptionalfeature':
      return <p><b>{String(e.classFeature || e.subclassFeature || e.optionalfeature || '').split('|')[0]}</b></p>;
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
