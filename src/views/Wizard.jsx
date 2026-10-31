import React, { useMemo, useState } from 'react';
import { useT, ABILS, ABIL_LONG, ABIL_NAMES } from '../i18n.js';
import { makeFilter, equipmentGroups, POINT_COST, fmtMod, mod, stripTags, dedupeByName } from '../engine/rules.js';
import { uidOf, sourceGroup } from '../data/loader.js';
import { Choices } from '../components/Shared.jsx';
import ClassInfo from '../components/ClassInfo.jsx';
import { buildFacets, applyFacets, activeCount } from '../filters.js';
import Entries from '../components/Entries.jsx';

export default function Wizard(props) {
  const { ch, d, update, setView, createChar } = props;
  const { t } = useT();
  const [step, setStep] = useState(ch?.wizardDone ? 1 : 0);
  if (!ch || !d) return <div className="loading"><button className="btn primary" onClick={createChar}>{t.newChar}</button></div>;
  const steps = t.steps;
  const stepOpen = (i) => {
    if (i === 1) return d.choices.filter(c => c.group === 'race' && c.required && !isDone(c)).length + (ch.raceUid ? 0 : 1);
    if (i === 2) return (ch.levels.length ? 0 : 1) + d.choices.filter(c => c.group === 'class' && c.required && !isDone(c)).length;
    if (i === 3) return (ch.backgroundUid ? 0 : 1) + d.choices.filter(c => c.group === 'background' && c.required && !isDone(c)).length;
    if (i === 5) return d.choices.filter(c => (c.group === 'level' || c.group === 'feat') && c.required && !isDone(c)).length;
    return 0;
  };
  return (
    <>
      <ol className="steps" aria-label="steps">
        {steps.map((s, i) => (
          <li key={i}><button className={i === step ? 'cur' : stepOpen(i) === 0 && i < step ? 'done' : ''} onClick={() => setStep(i)}>
            <span className="n">{i < step && stepOpen(i) === 0 ? '✓' : i + 1}</span>{s}{stepOpen(i) > 0 && i !== step ? <span className="tag req">{stepOpen(i)}</span> : null}
          </button></li>
        ))}
      </ol>
      {step === 0 && <Basics {...props} />}
      {step === 1 && <RaceStep {...props} />}
      {step === 2 && <ClassStep {...props} />}
      {step === 3 && <BgStep {...props} />}
      {step === 4 && <AbilityStep {...props} />}
      {step === 5 && <ChoicesStep {...props} />}
      {step === 6 && <EquipStep {...props} />}
      {step === 7 && <DoneStep {...props} />}
      <div className="row" style={{ padding: '0 22px 26px' }}>
        <span className="muted">{stepOpen(step) > 0 ? t.reqDone : ''}</span>
        <div className="grow" />
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>{t.back}</button>}
        {step < steps.length - 1 && <button className="btn primary" onClick={() => setStep(step + 1)}>{t.next}: {steps[step + 1]}</button>}
        {step === steps.length - 1 && <button className="btn primary" onClick={() => { finish(props); setView('sheet'); }}>{t.finish}</button>}
      </div>
    </>
  );
}

function isDone(c) { return !d_open(c); }
function d_open(c) {
  // mirrors engine isComplete without import cycle
  const v = c.value;
  if (['pick', 'skill', 'abil', 'feat', 'lang'].includes(c.kind)) return !(Array.isArray(v) && v.length >= Math.min(c.count || 1, (c.options || []).length || 1));
  if (c.kind === 'weighted') return !(v && v.mode != null && v.abil?.filter(Boolean).length === c.modes[v.mode].length);
  if (c.kind === 'flexAsi') return !(v && v.abil?.filter(Boolean).length === (v.mode === '111' ? 3 : 2));
  if (c.kind === 'asiFeat') return !(v && (v.mode === 'feat' ? v.feat : v.mode === 'asi2' ? v.abil?.[0] : v.abil?.[0] && v.abil?.[1]));
  if (c.kind === 'text') return !(v && String(v).trim());
  return v == null;
}

function finish({ ch, db, update }) {
  update(c => {
    if (!c.equipApplied && !c.equipSkip) {
      for (const [key, ent] of [['class', db.byUid.class.get(c.levels[0]?.classUid)], ['bg', db.byUid.background.get(c.backgroundUid)]]) {
        const groups = equipmentGroups(db, ent);
        groups.forEach((opts, gi) => {
          const chosenKey = c.equipChoices?.[key + gi] || opts.find(o => !o.fixed)?.key;
          for (const o of opts) {
            if (!(o.fixed || o.key === chosenKey)) continue;
            for (const it of o.items) {
              if (it.gold) c.gold = (c.gold || 0) + it.gold;
              else c.inventory.push({ id: 'i' + Math.random().toString(36).slice(2), uid: it.uid, name: it.name, qty: it.qty || 1, equipped: false });
              if (it.containsValue) c.gold = (c.gold || 0) + it.containsValue / 100;
            }
          }
        });
      }
      // auto-equip first armor and shield
      let armorDone = false; let shieldDone = false;
      c.inventory = c.inventory.map(x => {
        const ty = String(db.byUid.item.get(x.uid)?.type || '').split('|')[0];
        if (!armorDone && ['LA', 'MA', 'HA'].includes(ty)) { armorDone = true; return { ...x, equipped: true }; }
        if (!shieldDone && ty === 'S') { shieldDone = true; return { ...x, equipped: true }; }
        return x;
      });
      c.equipApplied = true;
    }
    c.wizardDone = true;
    return c;
  });
}

function Basics({ ch, update }) {
  const { t } = useT();
  return (
    <div className="page">
      <div className="card col" style={{ flex: '1 1 420px', maxWidth: 620 }}>
        <label className="col" style={{ gap: 6 }}><span className="bold">{t.charName}</span>
          <input aria-label={t.charName} value={ch.name} placeholder={t.untitled} onChange={e => update(c => { c.name = e.target.value; return c; })} /></label>
        <div className="col" style={{ gap: 6 }}>
          <span className="bold">{t.rulesVersion}</span>
          <div className="seg">
            {['2024', '2014'].map(r => <button key={r} className={ch.rules === r ? 'on' : ''} onClick={() => update(c => { c.rules = r; c.raceUid = null; c.backgroundUid = null; c.levels = []; c.choices = {}; return c; })}>D&D {r}</button>)}
          </div>
          <span className="muted small">{ch.rules === '2014' ? t.rules2014 : t.rules2024}</span>
        </div>
      </div>
    </div>
  );
}

function fmtVal(f, v, t, lang) {
  if (f.fmt === 'abil') return ABIL_LONG[lang]?.[v] || v;
  if (f.fmt === 'yesno') return v === 'yes' ? t.fYes : t.fNo;
  if (f.fmt === 'none' && v === 'none') return t.fNone;
  if (f.fmt === 'speed') return t['f' + v[0].toUpperCase() + v.slice(1)] || v;
  if (f.fmt === 'caster') return v === 'no' ? t.fNo : ({ full: t.fFull, '1/2': t.fHalf, '1/3': t.fThird, pact: t.fPact }[v] || t.fYes);
  return v;
}

function FilterPanel({ facets, state, setState, t, lang, db }) {
  const [openId, setOpenId] = useState(null);
  const cycle = (id, v) => setState(s => {
    const cur = s[id] || { vals: {}, and: false };
    const vals = { ...cur.vals }; const nx = ((vals[v] || 0) + 1) % 3;
    if (nx) vals[v] = nx; else delete vals[v];
    return { ...s, [id]: { ...cur, vals } };
  });
  const toggleAnd = id => setState(s => ({ ...s, [id]: { vals: {}, ...s[id], and: !s[id]?.and } }));
  return (
    <div className="col filterpanel" style={{ gap: 4 }}>
      <span className="muted small">{t.fHint}</span>
      {facets.map(f => {
        const st = state[f.id]; const n = Object.keys(st?.vals || {}).length; const open = openId === f.id || n > 0 && openId === null && false;
        return (
          <div key={f.id} className="col" style={{ gap: 4 }}>
            <button className="filterhead" onClick={() => setOpenId(openId === f.id ? '' : f.id)}>
              <span className="bold grow">{t[f.label]}</span>
              {n > 0 && <span className="badge">{n}</span>}
              <span className="muted">{openId === f.id ? '▴' : '▾'}</span>
            </button>
            {openId === f.id && (
              <div className="row wrap" style={{ gap: 4, padding: '2px 0 6px' }}>
                {f.values.map(({ v, n: cnt }) => {
                  const s = st?.vals?.[v] || 0;
                  const label = f.fmt === 'source' ? (db.sourceMeta[v]?.abbr || v) : fmtVal(f, v, t, lang);
                  return <button key={v} title={f.fmt === 'source' ? db.sourceMeta[v]?.name : undefined} className={'chip fchip' + (s === 1 ? ' inc' : s === 2 ? ' exc' : '')} onClick={() => cycle(f.id, v)}>{s === 2 ? '− ' : s === 1 ? '+ ' : ''}{label} <span className="muted">{cnt}</span></button>;
                })}
                <button className="chip" onClick={() => toggleAnd(f.id)} title={t.fAnd + ' / ' + t.fOr}>{t.fMatch}: {st?.and ? t.fAnd : t.fOr}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EntityList({ list, selected, onPick, t, db, kind }) {
  const { lang } = useT();
  const [q, setQ] = useState('');
  const [grp, setGrp] = useState('all');
  const [fOpen, setFOpen] = useState(false);
  const [fState, setFState] = useState({});
  const base = list.filter(e => (!q || e.name.toLowerCase().includes(q.toLowerCase())) && (grp === 'all' || (grp === 'hb' ? e.__origin === 'homebrew' : e.__origin !== 'homebrew')));
  const facets = useMemo(() => kind ? buildFacets(kind, list) : [], [kind, list]);
  const shown = kind ? applyFacets(kind, base, fState) : base;
  const nAct = activeCount(fState);
  return (
    <section className="card col" style={{ flex: '1 1 300px', maxWidth: 400 }}>
      <input placeholder={t.search} value={q} onChange={e => setQ(e.target.value)} aria-label={t.search} />
      <div className="row wrap" style={{ gap: 6 }}>
        {[['all', 'Alle / All'], ['off', 'Offiziell'], ['hb', t.srcHomebrew]].map(([k, l]) => <button key={k} className={'chip' + (grp === k ? ' on' : '')} onClick={() => setGrp(k)}>{l}</button>)}
        {facets.length > 0 && <button className={'chip' + (fOpen || nAct ? ' on' : '')} onClick={() => setFOpen(!fOpen)}>{t.filters}{nAct ? ` (${nAct})` : ''} {fOpen ? '▴' : '▾'}</button>}
        {nAct > 0 && <button className="chip" onClick={() => setFState({})}>{t.fReset}</button>}
      </div>
      {fOpen && <FilterPanel facets={facets} state={fState} setState={setFState} t={t} lang={lang} db={db} />}
      {(nAct > 0 || q) && <span className="muted small">{t.fShown(shown.length, list.length)}</span>}
      <div className="col scroll" style={{ gap: 6, maxHeight: 560 }}>
        {shown.map(e => (
          <button key={uidOf(e)} className={'listbtn' + (selected === uidOf(e) ? ' sel' : '')} onClick={() => onPick(e)}>
            <span className="bold grow">{e.name}</span><span className="muted small">{db.sourceMeta[e.source]?.abbr || e.source}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function RaceStep(props) {
  const { db, settings, ch, d, update } = props;
  const { t } = useT();
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const races = useMemo(() => db.races.filter(allowed).sort((a, b) => a.name.localeCompare(b.name)), [db, allowed]);
  const race = d.race;
  return (
    <div className="page">
      <EntityList kind="race" list={races} selected={ch.raceUid} db={db} t={t} onPick={e => update(c => {
        c.raceUid = uidOf(e);
        for (const k of Object.keys(c.choices)) if (k.startsWith('race:')) delete c.choices[k];
        return c;
      })} />
      <section className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
        {race && <Detail title={d.baseRace?.name} src={db.sourceMeta[d.baseRace?.source]?.name || d.baseRace?.source}
          facts={[race.size && 'Size: ' + [].concat(race.size).join('/'), race.speed && t.speed + ': ' + (typeof race.speed === 'number' ? race.speed : race.speed.walk) + ' ft', race.darkvision && t.darkvision + ' ' + race.darkvision + ' ft'].filter(Boolean)}
          entries={race.entries} />}
        <Choices list={d.choices.filter(c => c.group === 'race')} update={update} d={d} />
      </section>
    </div>
  );
}

function ClassStep(props) {
  const { db, settings, ch, d, update } = props;
  const { t } = useT();
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const classes = useMemo(() => dedupeByName(db.classes.filter(allowed), settings.rules === '2014' ? 'PHB' : 'XPHB').sort((a, b) => a.name.localeCompare(b.name)), [db, allowed, settings.rules]);
  const first = ch.levels[0]?.classUid;
  const cls = first && db.byUid.class.get(first);
  const startLevel = ch.levels.filter(l => l.classUid === first).length || 1;
  return (
    <div className="page">
      <EntityList kind="class" list={classes} selected={first} db={db} t={t} onPick={e => update(c => {
        const old = c.levels[0]?.classUid; const nu = uidOf(e);
        if (!c.levels.length) c.levels = [{ classUid: nu }];
        else c.levels = c.levels.map(l => (l.classUid === old ? { ...l, classUid: nu } : l));
        for (const k of Object.keys(c.choices)) if (old && k.includes(old)) delete c.choices[k];
        c.equipChoices = {}; return c;
      })} />
      <section className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
        {cls && (
          <>
            <div className="card row">
              <span className="bold">{t.level}</span>
              <input type="number" min="1" max="20" style={{ width: 90 }} aria-label={t.level} value={startLevel} onChange={e => {
                const n = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                update(c => { const others = c.levels.filter(l => l.classUid !== first); c.levels = [...Array.from({ length: n }, (_, i) => c.levels.filter(l => l.classUid === first)[i] || { classUid: first }), ...others]; return c; });
              }} />
              <span className="muted small">HD d{cls.hd?.faces} · {t.save_}: {(cls.proficiency || []).map(a => a.toUpperCase()).join(', ')}</span>
            </div>
            <div className="card row" style={{ alignItems: 'baseline' }}>
              <h1 className="serif" style={{ fontSize: 26, margin: 0 }}>{cls.name}</h1><span className="muted">{db.sourceMeta[cls.source]?.name || cls.source}</span>
            </div>
            <Choices list={d.choices.filter(c => c.group === 'class')} update={update} d={d} />
            <ClassInfo db={db} settings={settings} cls={cls} level={startLevel} />
          </>
        )}
        {!cls && <Choices list={d.choices.filter(c => c.group === 'class')} update={update} d={d} />}
      </section>
    </div>
  );
}

function BgStep(props) {
  const { db, settings, ch, d, update } = props;
  const { t } = useT();
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const bgs = useMemo(() => db.backgrounds.filter(allowed).sort((a, b) => a.name.localeCompare(b.name)), [db, allowed]);
  const bg = d.background;
  return (
    <div className="page">
      <EntityList kind="background" list={bgs} selected={ch.backgroundUid} db={db} t={t} onPick={e => update(c => {
        c.backgroundUid = uidOf(e);
        for (const k of Object.keys(c.choices)) if (k.startsWith('bg:') || k.startsWith('background:')) delete c.choices[k];
        c.equipChoices = {}; return c;
      })} />
      <section className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
        {bg && <Detail title={bg.name} src={db.sourceMeta[bg.source]?.name || bg.source} entries={bg.entries} />}
        <Choices list={d.choices.filter(c => c.group === 'background')} update={update} d={d} />
      </section>
    </div>
  );
}

function Detail({ title, src, facts, entries }) {
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(true);
  const { t } = useT();
  return (
    <div className="card">
      <button className="collapse-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <h1 className="serif" style={{ fontSize: 26 }}>{title}</h1><span className="muted">{src}</span><span className="grow" /><span className="chev">{open ? '▾' : '▸'}</span>
      </button>
      {open && facts?.length > 0 && <div className="row" style={{ marginTop: 10, gap: 6 }}>{facts.map((f, i) => <span key={i} className="chip">{stripTags(f)}</span>)}</div>}
      {open && entries && (
        <div style={{ marginTop: 12 }}>
          <div className={more ? '' : 'fadeclip'}><Entries entries={entries} /></div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setMore(!more)}>{more ? t.hideInfo : t.moreInfo}</button>
        </div>
      )}
    </div>
  );
}

// ---------------- Abilities ----------------
const rnd = (sides) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % sides); };

function rollSets(rule) {
  const sets = [];
  for (let k = 0; k < rule.sets; k++) {
    const dice = [];
    for (let i = 0; i < rule.n; i++) { let v = rnd(rule.sides); if (rule.ones) { let guard = 0; while (v === 1 && guard++ < 50) v = rnd(rule.sides); } dice.push(v); }
    const order = dice.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const dropped = new Set(order.slice(0, Math.min(rule.drop, rule.n - 1)).map(x => x[1]));
    const total = dice.reduce((a, v, i) => a + (dropped.has(i) ? 0 : v), 0) + rule.bonus;
    sets.push({ dice, dropped: [...dropped], total });
  }
  return sets;
}
function baseFrom(gen) {
  const out = {};
  for (const a of ABILS) { const idx = gen.assign?.[a]; out[a] = idx != null && gen.values[idx] != null ? gen.values[idx] : 8; }
  return out;
}
const PRESETS = { '4d6': { n: 4, sides: 6, drop: 1, bonus: 0 }, '3d6': { n: 3, sides: 6, drop: 0, bonus: 0 }, '2d6+6': { n: 2, sides: 6, drop: 0, bonus: 6 }, '5d6': { n: 5, sides: 6, drop: 2, bonus: 0 } };

function AbilityStep({ ch, d, update }) {
  const { t, lang } = useT();
  const gen = ch.abilityGen;
  const setGen = (fn) => update(c => { fn(c.abilityGen); if (['standard', 'roll'].includes(c.abilityGen.method)) c.base = baseFrom(c.abilityGen); return c; });
  const rule = gen.rule;
  const spent = ABILS.reduce((s, a) => s + (POINT_COST[ch.base[a]] ?? 99), 0);
  const step = (k, delta, lo, hi) => setGen(g => { g.rule[k] = Math.max(lo, Math.min(hi, g.rule[k] + delta)); });
  const sidesList = [4, 6, 8, 10, 12, 20];
  return (
    <div className="page">
      <section className="card col" style={{ flex: '1 1 320px', maxWidth: 430 }}>
        <span className="bold">{t.method}</span>
        <div className="seg">
          {[['standard', t.standardArray], ['pointbuy', t.pointBuy], ['roll', t.roll], ['manual', t.manual]].map(([k, l]) => (
            <button key={k} className={gen.method === k ? 'on' : ''} onClick={() => update(c => {
              c.abilityGen.method = k;
              if (k === 'standard') { c.abilityGen.values = [15, 14, 13, 12, 10, 8]; c.abilityGen.assign = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5 }; c.base = baseFrom(c.abilityGen); }
              if (k === 'pointbuy') c.base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
              if (k === 'roll') { c.abilityGen.values = []; c.abilityGen.assign = {}; }
              return c;
            })}>{l}</button>
          ))}
        </div>
        {gen.method === 'roll' && (
          <>
            <div className="row" style={{ gap: 6 }}>
              {Object.entries(PRESETS).map(([k, p]) => <button key={k} className={'chip' + (rule.n === p.n && rule.drop === p.drop && rule.bonus === p.bonus && rule.sides === 6 ? ' on' : '')} onClick={() => setGen(g => { Object.assign(g.rule, p, { sides: 6 }); })}>{k === '4d6' ? '4W6 −1' : k === '5d6' ? '5W6 −2' : k.replace('d', 'W')}</button>)}
            </div>
            <span className="bold">{t.rollRule}</span>
            <div className="grid g2">
              <Stepper label={t.diceCount} val={rule.n} dec={() => step('n', -1, 1, 8)} inc={() => step('n', 1, 1, 8)} />
              <Stepper label={t.dieType} val={(lang === 'de' ? 'W' : 'd') + rule.sides} dec={() => setGen(g => { g.rule.sides = sidesList[Math.max(0, sidesList.indexOf(g.rule.sides) - 1)]; })} inc={() => setGen(g => { g.rule.sides = sidesList[Math.min(sidesList.length - 1, sidesList.indexOf(g.rule.sides) + 1)]; })} />
              <Stepper label={t.dropLowest} val={rule.drop} dec={() => step('drop', -1, 0, 4)} inc={() => step('drop', 1, 0, 4)} />
              <Stepper label={t.bonusPer} val={(rule.bonus >= 0 ? '+' : '') + rule.bonus} dec={() => step('bonus', -1, -10, 10)} inc={() => step('bonus', 1, -10, 10)} />
              <Stepper label={t.valueCount} val={rule.sets} dec={() => step('sets', -1, 6, 9)} inc={() => step('sets', 1, 6, 9)} />
            </div>
            <label className="row"><input type="checkbox" checked={!!rule.ones} onChange={() => setGen(g => { g.rule.ones = !g.rule.ones; })} />{t.rerollOnes}</label>
            <button className="btn primary" onClick={() => setGen(g => {
              const sets = rollSets(g.rule);
              g.lastRoll = sets; g.values = sets.map(s => s.total); g.assign = {}; ABILS.forEach((a, i) => { if (i < g.values.length) g.assign[a] = i; });
              const desc = `${g.rule.n}${lang === 'de' ? 'W' : 'd'}${g.rule.sides}${g.rule.drop ? ' −' + g.rule.drop : ''}${g.rule.bonus ? ' ' + (g.rule.bonus > 0 ? '+' : '') + g.rule.bonus : ''}${g.rule.ones ? ' (1→)' : ''}: ${g.values.join(', ')}`;
              g.log = [{ at: Date.now(), txt: desc }, ...(g.log || [])].slice(0, 20);
            })}>{t.roll}</button>
            {(gen.log || []).length > 0 && (
              <div className="col" style={{ gap: 4 }}>
                <span className="bold small">{t.rollLog}</span>
                {gen.log.map((l, i) => <span key={i} className="muted small">{new Date(l.at).toLocaleTimeString(lang)} · {l.txt}</span>)}
              </div>
            )}
          </>
        )}
        {['standard', 'roll'].includes(gen.method) && gen.values.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setGen(g => { g.assign = {}; })}>{t.clearAssign}</button>
            <span className="muted small">{t.swapHint}</span>
          </div>
        )}
        {gen.method === 'pointbuy' && <div className={'bold' + (27 - spent < 0 ? '' : '')} style={{ color: 27 - spent < 0 ? 'var(--bad)' : 'var(--accent2)' }}>{t.pointsLeft(27 - spent)}</div>}
      </section>

      <section className="col" style={{ flex: '999 1 520px', minWidth: 0 }}>
        {gen.method === 'roll' && gen.lastRoll && (
          <div className="card"><div className="grid g3">
            {gen.lastRoll.map((s, i) => (
              <div key={i} className="row" style={{ padding: 10, borderRadius: 10, background: 'var(--panel2)', gap: 6 }}>
                {s.dice.map((v, j) => <span key={j} className={'die' + (s.dropped.includes(j) ? ' drop' : '')}>{v}</span>)}
                <div className="grow" /><span style={{ fontSize: 22, fontWeight: 700 }}>{s.total}</span>
              </div>
            ))}
          </div></div>
        )}
        <div className="card">
          <div className="grid" style={{ gridTemplateColumns: '1.4fr 1.4fr .8fr .8fr .8fr', alignItems: 'center' }}>
            <span className="muted small">{t.abilities}</span><span className="muted small">{t.base}</span><span className="muted small">{t.bonus}</span><span className="muted small">{t.total}</span><span className="muted small">{t.mod}</span>
            {ABILS.map(a => (
              <React.Fragment key={a}>
                <span className="bold">{ABIL_LONG[lang][a]}</span>
                <span>
                  {['standard', 'roll'].includes(gen.method) && (
                    <select aria-label={ABIL_LONG[lang][a]} value={gen.assign?.[a] ?? ''} onChange={e => setGen(g => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      const prev = g.assign[a];
                      // value already used elsewhere → swap the two fields
                      for (const k of ABILS) if (k !== a && v != null && g.assign[k] === v) { if (prev != null) g.assign[k] = prev; else delete g.assign[k]; }
                      if (v == null) delete g.assign[a]; else g.assign[a] = v;
                    })}>
                      <option value="">—</option>
                      {gen.values.map((v, i) => <option key={i} value={i}>{v}{Object.entries(gen.assign || {}).some(([k, x]) => x === i && k !== a) ? ' ⇄' : ''}</option>)}
                    </select>
                  )}
                  {gen.method === 'pointbuy' && (
                    <span className="row" style={{ gap: 6 }}>
                      <button className="btn sm" aria-label="-" disabled={ch.base[a] <= 8} onClick={() => update(c => { c.base[a]--; return c; })}>−</button>
                      <b style={{ width: 26, textAlign: 'center' }}>{ch.base[a]}</b>
                      <button className="btn sm" aria-label="+" disabled={ch.base[a] >= 15} onClick={() => update(c => { c.base[a]++; return c; })}>+</button>
                    </span>
                  )}
                  {gen.method === 'manual' && <input type="number" min="1" max="30" style={{ width: 80 }} aria-label={ABIL_LONG[lang][a]} value={ch.base[a]} onChange={e => update(c => { c.base[a] = Math.max(1, Math.min(30, Number(e.target.value) || 1)); return c; })} />}
                </span>
                <span className="muted">{d.abilBonus[a] ? fmtMod(d.abilBonus[a]) : '—'}</span>
                <span className="bold" style={{ fontSize: 18 }}>{d.scores[a]}</span>
                <span className="bold">{fmtMod(mod(d.scores[a]))}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <Choices list={d.choices.filter(c => ['weighted', 'flexAsi'].includes(c.kind) || (c.kind === 'abil' && c.group !== 'feat'))} update={update} d={d} />
      </section>
    </div>
  );
}

function Stepper({ label, val, dec, inc }) {
  return (
    <div className="col" style={{ gap: 4 }}>
      <span className="muted small">{label}</span>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <button className="btn sm" onClick={dec} aria-label={label + ' −'}>−</button>
        <b className="grow" style={{ textAlign: 'center', fontSize: 17 }}>{val}</b>
        <button className="btn sm" onClick={inc} aria-label={label + ' +'}>+</button>
      </div>
    </div>
  );
}

function ChoicesStep({ d, update }) {
  const { t } = useT();
  const list = d.choices.filter(c => c.group === 'level' || c.group === 'feat' || (c.group === 'class' && c.kind === 'pick' && c.id.startsWith('sub:')));
  return (
    <div className="page"><section className="col" style={{ flex: '1 1 100%' }}>
      {list.length === 0 && <div className="banner ok" style={{ margin: 0 }}>{t.allDecided}</div>}
      <Choices list={list} update={update} d={d} />
    </section></div>
  );
}

function EquipStep({ db, ch, update }) {
  const { t } = useT();
  const sets = [['class', db.byUid.class.get(ch.levels[0]?.classUid)], ['bg', db.byUid.background.get(ch.backgroundUid)]];
  return (
    <div className="page"><section className="col" style={{ flex: '1 1 100%' }}>
      {ch.equipApplied && <div className="banner info" style={{ margin: 0 }}>{t.startEquip} ✓ – {t.inventory}</div>}
      <label className="card row" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={!!ch.equipSkip} onChange={e => update(c => { c.equipSkip = e.target.checked; return c; })} />
        <span className="col" style={{ gap: 2 }}><span className="bold">{t.skipEquip}</span><span className="muted small">{t.skipEquipSub}</span></span>
      </label>
      {!ch.equipSkip && sets.map(([key, ent]) => ent && (
        <div key={key} className="card col">
          <h3>{t.startEquip}: {ent.name}</h3>
          {equipmentGroups(db, ent).map((opts, gi) => {
            const chosen = ch.equipChoices?.[key + gi] || opts.find(o => !o.fixed)?.key;
            return (
              <div key={gi} className="col" style={{ gap: 6 }}>
                {opts.map(o => (
                  <label key={o.key} className={'listbtn' + (o.fixed || chosen === o.key ? ' sel' : '')} style={{ cursor: o.fixed ? 'default' : 'pointer' }}>
                    {!o.fixed && <input type="radio" name={key + gi} checked={chosen === o.key} onChange={() => update(c => { c.equipChoices = { ...(c.equipChoices || {}), [key + gi]: o.key }; return c; })} />}
                    <span className="bold">{o.fixed ? '•' : t.optionA + ' ' + o.key.toUpperCase()}</span>
                    <span className="grow">{o.items.map(i => (i.qty > 1 ? i.qty + '× ' : '') + i.name).join(', ')}</span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </section></div>
  );
}

function DoneStep({ d, ch }) {
  const { t, lang } = useT();
  return (
    <div className="page"><section className="col" style={{ flex: '1 1 100%' }}>
      <div className="card">
        <h1 className="serif">{ch.name || t.untitled}</h1>
        <div className="muted" style={{ marginTop: 6 }}>{d.summary}{d.background ? ' · ' + d.background.name : ''}</div>
        <div className="row" style={{ marginTop: 12 }}>
          {ABILS.map(a => <span key={a} className="pill">{ABIL_NAMES[lang][a]} {d.scores[a]} ({fmtMod(d.mods[a])})</span>)}
          <span className="pill">{t.hp} {d.hpMax}</span>
        </div>
      </div>
      {d.open.length > 0 ? <div className="banner" style={{ margin: 0 }}>{t.openDecisions(d.open.length)}: {d.open.map(c => c.label).join(', ')}</div>
        : <div className="banner ok" style={{ margin: 0 }}>{t.allDecided}</div>}
    </section></div>
  );
}
