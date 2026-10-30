import React, { useState } from 'react';
import { useT, ABILS, ABIL_NAMES, SKILLS, skillName } from '../i18n.js';
import { fmtMod } from '../engine/rules.js';
import { Choices, Feature, ExtrasEditor, Inventory, Collapsible } from '../components/Shared.jsx';
import { spellMeta } from '../components/Entries.jsx';
import Entries from '../components/Entries.jsx';
import { buildFoundryActor } from '../export/foundry.js';
import { api } from '../platform.js';

export default function Sheet(props) {
  const { db, ch, d, update, setView, createChar } = props;
  const { t, lang } = useT();
  const [tab, setTab] = useState('features');
  const [showDecisions, setShowDecisions] = useState(false);
  const [showFoundry, setShowFoundry] = useState(false);
  if (!ch || !d) {
    return (
      <div className="loading">
        <h2 className="serif">{t.noChar}</h2>
        <div className="muted">{t.noCharSub}</div>
        <button className="btn primary" onClick={createChar}>{t.newChar}</button>
      </div>
    );
  }
  const open = d.open;
  const xpLevel = d.totalLevel;
  const speedM = Math.round(d.speed * 0.3 * 10) / 10;
  return (
    <>
      {open.length > 0 && (
        <div className="banner">
          <b style={{ color: 'var(--accent2)' }}>{t.openDecisions(open.length)}</b>
          <span className="muted small">{open.slice(0, 3).map(c => c.label).join(' · ')}{open.length > 3 ? ' …' : ''}</span>
          <div className="grow" />
          <button className="btn primary" onClick={() => setShowDecisions(true)}>{t.decideNow}</button>
        </div>
      )}
      <div className="page">
        <section className="col" style={{ flex: '1 1 260px', maxWidth: 330 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="checker" style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {ch.portrait ? <img src={ch.portrait} alt="" style={{ maxHeight: '100%', maxWidth: '100%' }} />
                : <svg width="100" height="180" viewBox="0 0 120 200" aria-hidden="true"><circle cx="60" cy="34" r="22" fill="#3a3f49" /><path d="M24 196 L30 86 Q60 62 90 86 L96 196 Z" fill="#3a3f49" /></svg>}
              <button className="btn sm" style={{ position: 'absolute', right: 10, bottom: 10 }} onClick={() => setView('designer')}>{t.tabDesigner}</button>
            </div>
            <div className="col" style={{ padding: 16, gap: 6 }}>
              <input className="serif" style={{ fontSize: 22, background: 'transparent', border: '1px solid transparent', padding: '2px 4px' }} aria-label={t.charName}
                value={ch.name} placeholder={t.untitled} onChange={e => update(c => { c.name = e.target.value; return c; })} />
              <div className="muted">{d.race?.name || '—'}</div>
              <div className="muted">{d.classInfo.map(c => `${c.cls.name} ${c.level}${c.subclass ? ' (' + c.subclass.name + ')' : ''}`).join(' / ') || '—'}</div>
              <div className="muted">{d.background?.name || ''}</div>
              <button className="btn primary" style={{ marginTop: 8 }} onClick={() => setView('levelup')}>{t.levelUp}</button>
              <button className="btn" onClick={() => setView('wizard')}>{t.edit}: {t.steps[1]}, {t.steps[2]} …</button>
              <button className="btn" onClick={async () => {
                const actor = buildFoundryActor(db, ch, d);
                const path = await api.saveFile({ defaultName: (ch.name || 'character').replace(/[^\w-]+/g, '_') + '.foundry.json', filters: [{ name: 'JSON', extensions: ['json'] }], text: JSON.stringify(actor, null, 2) });
                if (path) setShowFoundry(true);
              }}>{t.foundryExport}</button>
            </div>
          </div>
          <Collapsible title={t.proficiencies} className="card tight">
            <div className="small" style={{ lineHeight: 1.6 }}>
              {d.armorProf.length > 0 && <div><b>Armor:</b> {d.armorProf.join(', ')}</div>}
              {d.weaponProf.length > 0 && <div><b>Weapons:</b> {d.weaponProf.join(', ')}</div>}
              {d.tools.length > 0 && <div><b>Tools:</b> {d.tools.join(', ')}</div>}
              {d.languages.length > 0 && <div><b>{t.languages}:</b> {d.languages.join(', ')}</div>}
              {d.resist.length > 0 && <div><b>{t.resist}:</b> {d.resist.join(', ')}</div>}
              {d.darkvision > 0 && <div><b>{t.darkvision}:</b> {d.darkvision} ft</div>}
            </div>
          </Collapsible>
        </section>

        <section className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
          <div className="grid g5">
            <Tile lab={t.ac} val={d.ac} />
            <Tile lab={t.hp} val={d.hpMax} />
            <Tile lab={t.init} val={fmtMod(d.initiative)} />
            <Tile lab={t.speed} val={lang === 'de' ? speedM + ' m' : d.speed + ' ft'} />
            <Tile lab={t.prof} val={fmtMod(d.prof)} />
          </div>
          <div className="grid g6">
            {ABILS.map(a => (
              <div key={a} className="tile">
                <div className="lab bold">{ABIL_NAMES[lang][a]}</div>
                <div className="val">{fmtMod(d.mods[a])}</div>
                <div className="pill" style={{ display: 'inline-block', marginTop: 4 }}>{d.scores[a]}</div>
                <div className="muted small" style={{ marginTop: 6 }}>{t.save_} {fmtMod(d.saves[a].bonus)}{d.saves[a].prof ? ' ●' : ''}</div>
              </div>
            ))}
          </div>
          <Collapsible title={t.skills}>
            <div className="grid g3" style={{ columnGap: 20, rowGap: 0 }}>
              {Object.keys(SKILLS).sort((a, b) => skillName(a, lang).localeCompare(skillName(b, lang))).map(k => (
                <div key={k} className="skillrow">
                  <span className={'dot' + (d.skills[k].prof ? ' on' : '')} />
                  <span className="grow">{skillName(k, lang)} <span className="dim small">{ABIL_NAMES[lang][SKILLS[k].ab]}</span></span>
                  <span className="bold">{fmtMod(d.skills[k].bonus)}</span>
                </div>
              ))}
            </div>
          </Collapsible>
        </section>

        <section className="card" style={{ flex: '1 1 320px', maxWidth: 440, padding: 0, overflow: 'hidden' }}>
          <div className="tabs" role="tablist">
            {[['features', t.features], ['spells', t.spells], ['inventory', t.inventory], ['extras', t.extras], ['notes', t.notes]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="col" style={{ padding: 14, gap: 8 }}>
            {tab === 'features' && (d.features.length ? d.features.map((f, i) => <Feature key={i} f={f} />) : <div className="muted">{t.sheetEmptyFeatures}</div>)}
            {tab === 'spells' && <Spells d={d} db={db} ch={ch} t={t} />}
            {tab === 'inventory' && <Inventory {...props} />}
            {tab === 'extras' && <ExtrasEditor {...props} />}
            {tab === 'notes' && <textarea rows={14} aria-label={t.notes} value={ch.notes || ''} onChange={e => update(c => { c.notes = e.target.value; return c; })} />}
          </div>
        </section>
      </div>
      {showFoundry && (
        <div className="modal-bg" onClick={() => setShowFoundry(false)}>
          <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()} role="dialog" aria-label={t.foundryTitle}>
            <div className="row"><h2 className="serif grow">{t.foundryTitle}</h2><button className="btn ghost" onClick={() => setShowFoundry(false)}>{t.close}</button></div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>{t.foundrySteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            <p className="muted small" style={{ margin: 0 }}>{t.foundryNote}</p>
          </div>
        </div>
      )}
      {showDecisions && (
        <div className="modal-bg" onClick={() => setShowDecisions(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.decideNow}>
            <div className="row"><h2 className="serif grow">{t.openDecisions(open.length)}</h2><button className="btn ghost" onClick={() => setShowDecisions(false)}>{t.close}</button></div>
            {open.length === 0 && <div className="banner ok" style={{ margin: 0 }}>{t.allDecided}</div>}
            <Choices list={open} update={update} d={d} />
          </div>
        </div>
      )}
    </>
  );
}

function Tile({ lab, val }) {
  return <div className="tile"><div className="lab">{lab}</div><div className="val">{val}</div></div>;
}

function Spells({ d, db, ch, t }) {
  const sc = d.spellcasting;
  const extraSpells = (ch.extras || []).filter(x => x.type === 'spell').map(x => ({ s: db.byUid.spell.get(x.uid), note: x.note })).filter(x => x.s);
  if (!sc.classes.length && !extraSpells.length) return <div className="muted">—</div>;
  return (
    <>
      {(sc.slots.length > 0 || sc.pact) && (
        <div className="feat">
          <div className="bold">{t.spellSlots}</div>
          <div className="row" style={{ marginTop: 6 }}>
            {sc.slots.map((n, i) => <span key={i} className="pill">{t.level} {i + 1}: {n}</span>)}
            {sc.pact && <span className="pill">Pact: {sc.pact.count} × {t.level} {sc.pact.level}</span>}
          </div>
        </div>
      )}
      {sc.classes.map(c => (
        <div key={c.name} className="col" style={{ gap: 6 }}>
          <div className="row"><b className="grow">{c.name}</b>{c.dc && <span className="muted small">{t.spellDC} {c.dc} · {t.spellAtk} {fmtMod(c.attack)}</span>}</div>
          {c.prepared && <div className="muted small">{t.prepared}: {c.prepared}</div>}
          {[...c.cantrips, ...c.spells].map(s => <SpellRow key={s.name + s.source} s={s} />)}
          {c.always.length > 0 && <div className="muted small">{t.alwaysPrepared}: {c.always.map(x => x.replace(/\b\w/g, m => m.toUpperCase())).join(', ')}</div>}
        </div>
      ))}
      {extraSpells.map(({ s, note }) => <SpellRow key={'x' + s.name} s={s} free note={note} />)}
    </>
  );
}

function SpellRow({ s, free, note }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="feat">
      <button style={{ all: 'unset', cursor: 'pointer', display: 'flex', gap: 8, width: '100%', alignItems: 'baseline' }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {free && <span className="tag free">{t.free}</span>}
        <span className="bold grow">{s.name}</span><span className="muted small">{s.level === 0 ? t.cantrips : t.level + ' ' + s.level}</span>
      </button>
      {note && <div className="muted small">{note}</div>}
      {open && <div style={{ marginTop: 6 }}><div className="muted small" style={{ marginBottom: 6 }}>{spellMeta(s)}</div><Entries entries={s.entries} /></div>}
    </div>
  );
}
