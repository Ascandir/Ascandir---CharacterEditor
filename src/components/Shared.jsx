import React, { useMemo, useState } from 'react';
import { useT, ABILS, ABIL_LONG, SKILLS, skillName } from '../i18n.js';
import { makeFilter } from '../engine/rules.js';
import { uidOf } from '../data/loader.js';
import ChoicePicker from './ChoicePicker.jsx';
import Entries, { spellMeta } from './Entries.jsx';

export function Collapsible({ title, right, children, defaultOpen = true, style, className = 'card' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className} style={style}>
      <button className="collapse-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <h3 style={{ margin: 0 }}>{title}</h3><span className="grow" />{right}<span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  );
}

export function Choices({ list, update, d }) {
  return list.map(c => (
    <ChoicePicker key={c.id} c={c} scores={d?.scores} totalLevel={d?.totalLevel}
      onChange={(v) => update(ch => { ch.choices[c.id] = v; return ch; })} />
  ));
}

export function Feature({ f }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="feat">
      <button className="h" style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, width: '100%', alignItems: 'baseline' }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {f.free && <span className="tag free">{t.free}</span>}
        <span className="bold grow">{f.name}</span>
        <span className="muted small">{f.from}</span>
      </button>
      {f.note && <div className="muted small">{f.note}</div>}
      {open && <div style={{ marginTop: 8 }}><Entries entries={f.entries} /></div>}
    </div>
  );
}

function SearchPick({ items, onPick, placeholder, render }) {
  const [q, setQ] = useState('');
  const res = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    return items.filter(i => i.name.toLowerCase().includes(s)).slice(0, 40);
  }, [q, items]);
  return (
    <div className="col" style={{ gap: 6 }}>
      <input placeholder={placeholder} value={q} onChange={e => setQ(e.target.value)} aria-label={placeholder} autoFocus />
      <div className="scroll" style={{ maxHeight: 260 }}>
        {res.map(i => (
          <button key={uidOf(i)} className="listbtn" style={{ marginBottom: 4 }} onClick={() => { onPick(i); setQ(''); }}>
            <span className="grow bold">{i.name}</span><span className="muted small">{render ? render(i) : i.source}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExtrasEditor({ db, settings, ch, update }) {
  const { t, lang } = useT();
  const [mode, setMode] = useState(null);
  const [form, setForm] = useState({});
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const featsAll = useMemo(() => db.feats.filter(allowed), [db, allowed]);
  const spellsAll = useMemo(() => db.spells.filter(allowed), [db, allowed]);
  const addExtra = (x) => { update(c => { c.extras = [...(c.extras || []), { id: 'x' + Date.now(), ...x }]; return c; }); setMode(null); setForm({}); };
  const label = (x) => {
    if (x.type === 'feat') return db.byUid.feat.get(x.uid)?.name || x.uid;
    if (x.type === 'spell') return db.byUid.spell.get(x.uid)?.name || x.uid;
    if (x.type === 'ability') return `${ABIL_LONG[lang][x.ability]} ${x.amount >= 0 ? '+' : ''}${x.amount}`;
    if (x.type === 'skill') return skillName(x.skill, lang);
    if (x.type === 'hp') return `${t.hp} ${x.amount >= 0 ? '+' : ''}${x.amount}`;
    if (x.type === 'ac') return `${t.ac} ${x.amount >= 0 ? '+' : ''}${x.amount}`;
    return x.name;
  };
  return (
    <Collapsible title={t.freeTitle} right={(ch.extras || []).length ? <span className="tag free">{(ch.extras || []).length}</span> : null} style={{ borderStyle: 'dashed', borderColor: 'var(--line2)' }}>
      <div className="row">
        <button className="btn sm" onClick={() => setMode('feat')}>{t.addFeat}</button>
        <button className="btn sm" onClick={() => setMode('feature')}>{t.addFeature}</button>
        <button className="btn sm" onClick={() => setMode('spell')}>{t.addSpell}</button>
        <button className="btn sm" onClick={() => setMode('ability')}>{t.addAbility}</button>
        <button className="btn sm" onClick={() => setMode('other')}>+ {t.skills} / {t.hp} / {t.ac}</button>
      </div>
      <p className="muted small">{t.freeSub}</p>
      {mode && (
        <div className="card tight" style={{ background: 'var(--panel2)', marginBottom: 10 }}>
          {mode === 'feat' && <SearchPick items={featsAll} placeholder={t.search} onPick={f => addExtra({ type: 'feat', uid: uidOf(f), note: form.note || '' })} />}
          {mode === 'spell' && <SearchPick items={spellsAll} placeholder={t.search} render={spellMeta} onPick={s => addExtra({ type: 'spell', uid: uidOf(s), note: form.note || '' })} />}
          {mode === 'feature' && (
            <div className="col" style={{ gap: 8 }}>
              <input placeholder={t.featureName} aria-label={t.featureName} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              <textarea rows={3} placeholder={t.featureText} aria-label={t.featureText} value={form.text || ''} onChange={e => setForm({ ...form, text: e.target.value })} />
              <button className="btn primary" disabled={!form.name} onClick={() => addExtra({ type: 'feature', name: form.name, text: form.text, note: form.note || '' })}>{t.add}</button>
            </div>
          )}
          {mode === 'ability' && (
            <div className="row">
              <select aria-label={t.abilities} value={form.ability || 'str'} onChange={e => setForm({ ...form, ability: e.target.value })}>
                {ABILS.map(a => <option key={a} value={a}>{ABIL_LONG[lang][a]}</option>)}
              </select>
              <input type="number" aria-label={t.amount} style={{ width: 90 }} value={form.amount ?? 1} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />
              <button className="btn primary" onClick={() => addExtra({ type: 'ability', ability: form.ability || 'str', amount: form.amount ?? 1, note: form.note || '' })}>{t.add}</button>
            </div>
          )}
          {mode === 'other' && (
            <div className="row">
              <select aria-label="type" value={form.kind || 'skill'} onChange={e => setForm({ ...form, kind: e.target.value })}>
                <option value="skill">{t.skills}</option><option value="hp">{t.hp}</option><option value="ac">{t.ac}</option>
              </select>
              {(form.kind || 'skill') === 'skill'
                ? <select aria-label={t.skills} value={form.skill || 'athletics'} onChange={e => setForm({ ...form, skill: e.target.value })}>{Object.keys(SKILLS).map(s => <option key={s} value={s}>{skillName(s, lang)}</option>)}</select>
                : <input type="number" aria-label={t.amount} style={{ width: 90 }} value={form.amount ?? 1} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} />}
              <button className="btn primary" onClick={() => addExtra((form.kind || 'skill') === 'skill' ? { type: 'skill', skill: form.skill || 'athletics', note: form.note || '' } : { type: form.kind, amount: form.amount ?? 1, note: form.note || '' })}>{t.add}</button>
            </div>
          )}
          <div className="row" style={{ marginTop: 8 }}>
            <input className="grow" placeholder={t.note} aria-label={t.note} value={form.note || ''} onChange={e => setForm({ ...form, note: e.target.value })} />
            <button className="btn ghost sm" onClick={() => { setMode(null); setForm({}); }}>{t.cancel}</button>
          </div>
        </div>
      )}
      <div className="col" style={{ gap: 6 }}>
        {(ch.extras || []).map(x => (
          <div key={x.id} className="row" style={{ padding: 10, borderRadius: 10, background: 'var(--panel2)' }}>
            <span className="tag free">{t.free}</span>
            <span className="bold grow">{label(x)}</span>
            {x.note && <span className="muted small">{x.note}</span>}
            <button className="btn sm ghost" onClick={() => update(c => { c.extras = c.extras.filter(e => e.id !== x.id); return c; })}>{t.remove}</button>
          </div>
        ))}
      </div>
    </Collapsible>
  );
}

export function Inventory({ db, settings, ch, update }) {
  const { t } = useT();
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const items = useMemo(() => db.items.filter(allowed), [db, allowed]);
  const typeOf = (it) => String(db.byUid.item.get(it.uid)?.type || '').split('|')[0];
  const equippable = (it) => ['LA', 'MA', 'HA', 'S', 'M', 'R'].includes(typeOf(it));
  return (
    <div className="col">
      <div className="row">
        <label className="row" style={{ gap: 6 }}><span className="bold">{t.gold}</span>
          <input type="number" style={{ width: 110 }} value={ch.gold || 0} onChange={e => update(c => { c.gold = Number(e.target.value); return c; })} aria-label={t.gold} /></label>
      </div>
      <SearchPick items={items} placeholder={t.addItemSearch} onPick={i => update(c => { c.inventory = [...(c.inventory || []), { id: 'i' + Date.now(), uid: uidOf(i), name: i.name, qty: 1, equipped: false }]; return c; })} />
      <div className="col" style={{ gap: 6 }}>
        {(ch.inventory || []).map(it => (
          <div key={it.id} className="row" style={{ padding: 10, borderRadius: 10, background: 'var(--panel2)' }}>
            <span className="bold grow">{it.name}</span>
            {it.equipped && <span className="tag">{t.equipped}</span>}
            <input type="number" min="0" style={{ width: 70 }} aria-label={t.qty} value={it.qty} onChange={e => update(c => { c.inventory = c.inventory.map(x => x.id === it.id ? { ...x, qty: Number(e.target.value) } : x); return c; })} />
            {equippable(it) && <button className="btn sm" onClick={() => update(c => {
              const ty = typeOf(it);
              c.inventory = c.inventory.map(x => {
                if (x.id === it.id) return { ...x, equipped: !x.equipped };
                if (!it.equipped && ['LA', 'MA', 'HA'].includes(ty) && ['LA', 'MA', 'HA'].includes(typeOf(x))) return { ...x, equipped: false };
                return x;
              });
              return c;
            })}>{it.equipped ? t.unequip : t.equip}</button>}
            <button className="btn sm ghost" onClick={() => update(c => { c.inventory = c.inventory.filter(x => x.id !== it.id); return c; })}>{t.remove}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
