// Rules engine: derives everything about a character from data + stored decisions.
import { lc, uidOf, subclassUid, parseClassFeatureRef, parseSubclassFeatureRef } from '../data/loader.js';
import { ABILS, SKILLS } from '../i18n.js';

export const mod = (score) => Math.floor((score - 10) / 2);
export const profBonus = (lvl) => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
export const fmtMod = (n) => (n >= 0 ? '+' : '') + n;

const FULL_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const PACT = [null, [1, 1], [2, 1], [2, 2], [2, 2], [2, 3], [2, 3], [2, 4], [2, 4], [2, 5], [2, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [3, 5], [4, 5], [4, 5], [4, 5], [4, 5]];
export const STANDARD_LANGS = ['Common', 'Common Sign Language', 'Draconic', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin', 'Halfling', 'Orc',
  'Abyssal', 'Celestial', 'Deep Speech', 'Druidic', 'Infernal', 'Primordial', 'Sylvan', 'Thieves’ Cant', 'Undercommon'];
export const POINT_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function casterLevel(prog, lvl) {
  switch (prog) {
    case 'full': return lvl;
    case '1/2': return Math.floor(lvl / 2);
    case 'artificer': return Math.ceil(lvl / 2);
    case '1/3': return Math.floor(lvl / 3);
    default: return 0;
  }
}
function maxSpellLevelFor(prog, lvl) {
  if (prog === 'pact') return PACT[Math.min(20, lvl)]?.[1] || 0;
  const cl = casterLevel(prog, lvl);
  return (FULL_SLOTS[Math.min(20, cl)] || []).length;
}

// ---------- source / rules filter ----------
export function makeFilter(db, settings) {
  const disabled = new Set(settings.disabledSources || []);
  const rules = settings.rules || '2024';
  const known = db.sourceMeta;
  const srcOn = (s) => !disabled.has(s) && (known[s] ? known[s].group !== 'homebrew' || (settings.homebrew || []).includes(known[s].hbPath) : true);
  return (e) => {
    if (!e || !srcOn(e.source)) return false;
    if (rules === '2014' && e.edition === 'one') return false;
    if (rules === '2024' && Array.isArray(e.reprintedAs) && e.reprintedAs.length) {
      for (const r of e.reprintedAs) {
        const ref = typeof r === 'string' ? r : r?.uid;
        if (!ref) continue;
        const parts = ref.split('|');
        const src = parts[parts.length - 1] || 'PHB';
        if (srcOn(src.toUpperCase() === src ? src : src.toUpperCase()) || srcOn(src)) return false;
      }
    }
    return true;
  };
}

// ---------- helpers ----------
export function stripTags(s) {
  if (typeof s !== 'string') return s;
  let prev;
  do {
    prev = s;
    s = s.replace(/\{@(\w+)\s+([^{}]*?)\}/g, (_m, tag, body) => {
      const p = body.split('|');
      switch (tag) {
        case 'dc': return 'DC ' + p[0];
        case 'hit': return (Number(p[0]) >= 0 ? '+' : '') + p[0];
        case 'dice': case 'damage': case 'd20': case 'scaledice': case 'scaledamage': return p[p.length > 2 ? 2 : 0] || p[0];
        case 'filter': return p[0];
        case 'atk': return '';
        default: return p[2] || p[0];
      }
    });
  } while (s !== prev);
  return s.replace(/\{@\w+\}/g, '');
}
const itemName = (db, ref) => {
  const [n, src] = String(ref).split('|');
  const it = db.byUid.item.get(lc(n) + '|' + lc(src || 'phb'));
  return it ? it.name : n.replace(/\b\w/g, c => c.toUpperCase());
};
// "magic initiate; wizard|xphb" = the feat Magic Initiate with its Wizard variant
const featByRef = (db, ref) => { const [n, s] = ref.split('|'); return db.byUid.feat.get(lc(n.split(';')[0].trim()) + '|' + lc(s || 'phb')); };
const featVariant = (ref) => (ref.split('|')[0].split(';')[1] || '').trim();

export function classSpellList(db, cls) {
  db.__spellListCache = db.__spellListCache || new Map();
  const key = lc(cls.name) + '|' + lc(cls.source);
  if (db.__spellListCache.has(key)) return db.__spellListCache.get(key);
  const out = [];
  for (const sp of db.spells) {
    let ok = false;
    const l = db.spellLookup?.[lc(sp.source)]?.[lc(sp.name)];
    if (l) {
      for (const grp of [l.class, l.classVariant]) {
        if (!grp) continue;
        for (const [csrc, names] of Object.entries(grp)) {
          if (lc(csrc) === lc(cls.source) && Object.keys(names).some(n => lc(n) === lc(cls.name))) ok = true;
        }
      }
    }
    const fcl = sp.classes?.fromClassList;
    if (fcl && fcl.some(c => lc(c.name) === lc(cls.name) && (!c.source || lc(c.source) === lc(cls.source)))) ok = true;
    if (ok) out.push(sp);
  }
  out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  db.__spellListCache.set(key, out);
  return out;
}

function skillChoiceFromSets(sets) {
  // sets: [{athletics:true, choose:{from,count}, any:n}]
  const fixed = []; const chooses = [];
  for (const set of sets || []) {
    for (const [k, v] of Object.entries(set)) {
      if (k === 'choose') chooses.push({ from: v.from || Object.keys(SKILLS), count: v.count || 1 });
      else if (k === 'any') chooses.push({ from: Object.keys(SKILLS), count: v });
      else if (SKILLS[k] && v) fixed.push(k);
    }
    break; // first alternative set only
  }
  return { fixed, chooses };
}

function abilityFixedAndChoices(abilSet) {
  const fixed = {}; const chooses = [];
  for (const [k, v] of Object.entries(abilSet || {})) {
    if (k === 'choose') {
      if (v.weighted) chooses.push({ weighted: v.weighted });
      else chooses.push({ from: v.from || ABILS, count: v.count || 1, amount: v.amount || 1 });
    } else if (ABILS.includes(k)) fixed[k] = (fixed[k] || 0) + v;
  }
  return { fixed, chooses };
}

export function featPrereqText(f) {
  const out = [];
  for (const p of f.prerequisite || []) {
    if (p.level) out.push('Level ' + (typeof p.level === 'object' ? p.level.level : p.level));
    for (const a of p.ability || []) out.push(Object.entries(a).map(([k, v]) => k.toUpperCase() + ' ' + v).join('/'));
    if (p.spellcasting || p.spellcasting2020 || p.spellcastingFeature) out.push('Spellcasting');
    if (p.race) out.push(p.race.map(r => r.name).join('/'));
    if (p.feat) out.push(p.feat.map(x => x.split('|')[0]).join('/'));
    if (p.other) out.push(p.other);
  }
  return out.join(', ');
}
function featPrereqMet(f, ctx) {
  for (const p of f.prerequisite || []) {
    let ok = true;
    const lvl = typeof p.level === 'object' ? p.level.level : p.level;
    if (lvl && ctx.totalLevel < lvl) ok = false;
    if (p.ability && !p.ability.some(a => Object.entries(a).every(([k, v]) => (ctx.scores?.[k] || 0) >= v))) ok = false;
    if (ok) return true;
  }
  return !(f.prerequisite && f.prerequisite.length);
}

// ---------- the big derive ----------
// weapons with a mastery property that this class may pick
export function masteryWeapons(db, allowed, cls) {
  const name = lc(cls.name);
  const list = db.items.filter(i => i.__base && i.mastery?.length && allowed(i) && (i.weaponCategory || i.weapon));
  const filtered = list.filter(w => {
    const props = (w.property || []).map(p => String(typeof p === 'string' ? p : p.uid || '').split('|')[0]);
    const melee = String(w.type || '').split('|')[0] === 'M';
    if (name === 'barbarian') return melee;
    if (name === 'rogue') return w.weaponCategory === 'simple' || props.includes('F') || props.includes('L');
    return true;
  });
  return dedupeByName(filtered, cls.source).sort((a, b) => a.name.localeCompare(b.name));
}
function masteryEntries(db, w) {
  const out = [];
  for (const m of w.mastery || []) {
    const [nm, src] = String(m).split('|');
    const def = (db.itemMasteries || []).find(x => lc(x.name) === lc(nm) && (!src || lc(x.source) === lc(src)));
    if (def?.entries) out.push({ type: 'entries', name: nm, entries: def.entries });
  }
  return out;
}

export function derive(db, settings, ch) {
  const allowed = makeFilter(db, settings);
  const C = ch.choices || {};
  const choices = [];
  const features = [];
  const add = (c) => {
    let v = C[c.id];
    if (typeof v === 'string' && ['pick', 'skill', 'abil', 'feat', 'lang'].includes(c.kind)) { const o = (c.options || []).find(o => lc(o.value) === lc(v).trim()); v = o ? [o.value] : undefined; } // migrate old free-text answers
    c.value = v; choices.push(c); return v;
  };
  const skillProf = new Set(); const expertise = new Set(); const skillFixed = new Set();
  const abilBonus = Object.fromEntries(ABILS.map(a => [a, 0]));
  const notes = { resist: new Set(), languages: new Set(), tools: new Set(), armor: new Set(), weapons: new Set() };
  const feats = []; // {feat, ctx}
  const out = { choices, features, feats };

  // ----- race -----
  let race = ch.raceUid ? db.byUid.race.get(ch.raceUid) : null;
  let raceIncomplete = false;
  out.baseRace = race;
  if (race && race.__versions?.length) {
    const vs = race.__versions.filter(v => allowed(v) || v.source === race.source);
    const v = add({ id: 'race:version', group: 'race', label: race.name, kind: 'pick', count: 1, required: true,
      options: vs.map(v => ({ value: uidOf(v), label: v.name.replace(race.name, '').replace(/^[\s;(]+|[)]+$/g, '').trim() || v.name, entity: v })) });
    const chosen = v?.[0] && db.byUid.race.get(v[0]);
    if (chosen) race = chosen; else raceIncomplete = true;
  } else if (race) {
    const subs = db.subraces.filter(s => lc(s.raceName) === lc(race.name) && lc(s.raceSource) === lc(race.source) && s.name && allowed(s));
    if (subs.length) {
      const v = add({ id: 'race:subrace', group: 'race', label: race.name, kind: 'pick', count: 1, required: true,
        options: subs.map(s => ({ value: lc(s.name) + '|' + lc(s.source), label: s.name, src: s.source, entity: s })) });
      const sub = v?.[0] && subs.find(s => lc(s.name) + '|' + lc(s.source) === v[0]);
      if (sub) race = mergeSubrace(race, sub);
    }
  }
  out.race = race;
  if (race && !raceIncomplete) {
    // ability bonuses
    const rules2014 = (settings.rules || '2024') === '2014';
    if (race.ability?.length) {
      let set = race.ability[0];
      if (race.ability.length > 1) {
        const v = add({ id: 'race:abilset', group: 'race', label: 'Ability Score Increase', kind: 'pick', count: 1, required: true,
          options: race.ability.map((s, i) => ({ value: String(i), label: describeAbilSet(s) })) });
        if (v?.[0] != null) set = race.ability[Number(v[0])];
      }
      const { fixed, chooses } = abilityFixedAndChoices(set);
      for (const [k, n] of Object.entries(fixed)) abilBonus[k] += n;
      chooses.forEach((c, i) => {
        if (c.weighted) return;
        const v = add({ id: 'race:abil:' + i, group: 'race', label: 'Ability Score Increase (+' + c.amount + ')', kind: 'abil', count: c.count, required: true,
          options: c.from.map(a => ({ value: a, label: a })) });
        (v || []).forEach(a => { abilBonus[a] += c.amount; });
      });
    } else if (rules2014 && race.lineage) {
      const v = add({ id: 'race:lineage', group: 'race', label: 'Ability Score Increase', kind: 'flexAsi', required: true });
      applyFlexAsi(v, abilBonus);
    }
    // skills
    const rs = skillChoiceFromSets(race.skillProficiencies);
    rs.fixed.forEach(s => { skillProf.add(s); skillFixed.add(s); });
    rs.chooses.forEach((c, i) => {
      const v = add({ id: 'race:skill:' + i, group: 'race', label: 'Skill Proficiency', kind: 'skill', count: c.count, required: true,
        options: c.from.map(s => ({ value: s, label: s })) });
      (v || []).forEach(s => skillProf.add(s));
    });
    // languages
    langChoices(race.languageProficiencies, 'race', add, notes);
    toolChoices(race.toolProficiencies, 'race', add, notes);
    // resist
    for (const r of race.resist || []) {
      if (typeof r === 'string') notes.resist.add(r);
      else if (r.choose) {
        const v = add({ id: 'race:resist', group: 'race', label: 'Damage Resistance', kind: 'pick', count: 1, required: true,
          options: r.choose.from.map(x => ({ value: x, label: x })) });
        (v || []).forEach(x => notes.resist.add(x));
      }
    }
    // size
    if (Array.isArray(race.size) && race.size.length > 1) {
      add({ id: 'race:size', group: 'race', label: 'Size', kind: 'pick', count: 1, required: true,
        options: race.size.map(s => ({ value: s, label: { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large' }[s] || s })) });
    }
    // feats
    for (const [i, f] of (race.feats || []).entries()) {
      if (f.any) {
        const v = add({ id: 'race:feat:' + i, group: 'race', label: 'Feat', kind: 'feat', count: f.any, required: true,
          options: featOptions(db, allowed, settings, rules2014 ? null : ['O']) });
        (v || []).forEach(u => { const ft = db.byUid.feat.get(u); if (ft) feats.push({ feat: ft, ctx: 'race:feat:' + i + ':' + u, origin: 'race' }); });
      } else for (const ref of Object.keys(f)) { const ft = featByRef(db, ref); if (ft) feats.push({ feat: ft, ctx: 'race:' + ref, origin: 'race', variant: featVariant(ref) }); }
    }
    for (const e of race.entries || []) if (e && e.name) features.push({ name: e.name, from: race.name, kind: 'race', entries: e.entries });
  }

  // ----- background -----
  const bg = ch.backgroundUid ? db.byUid.background.get(ch.backgroundUid) : null;
  out.background = bg;
  if (bg) {
    if (bg.ability?.length) {
      const modes = bg.ability.map(a => a.choose?.weighted).filter(Boolean);
      if (modes.length) {
        const v = add({ id: 'bg:abil', group: 'background', label: 'Ability Scores', kind: 'weighted', required: true,
          from: modes[0].from, modes: modes.map(m => m.weights) });
        if (v && v.mode != null && Array.isArray(v.abil)) {
          const w = modes[v.mode]?.weights || [];
          v.abil.forEach((a, i) => { if (a && w[i]) abilBonus[a] += w[i]; });
        }
      } else {
        const { fixed, chooses } = abilityFixedAndChoices(bg.ability[0]);
        for (const [k, n] of Object.entries(fixed)) abilBonus[k] += n;
        chooses.forEach((c, i) => {
          const v = add({ id: 'bg:abil:' + i, group: 'background', label: 'Ability Score Increase (+' + c.amount + ')', kind: 'abil', count: c.count, required: true,
            options: c.from.map(a => ({ value: a, label: a })) });
          (v || []).forEach(a => { abilBonus[a] += c.amount; });
        });
      }
    }
    const bs = skillChoiceFromSets(bg.skillProficiencies);
    bs.fixed.forEach(s => { skillProf.add(s); skillFixed.add(s); });
    bs.chooses.forEach((c, i) => {
      const v = add({ id: 'bg:skill:' + i, group: 'background', label: 'Skill Proficiency', kind: 'skill', count: c.count, required: true,
        options: c.from.map(s => ({ value: s, label: s })) });
      (v || []).forEach(s => skillProf.add(s));
    });
    langChoices(bg.languageProficiencies, 'background', add, notes);
    toolChoices(bg.toolProficiencies, 'background', add, notes);
    for (const [i, f] of (bg.feats || []).entries()) {
      if (f.any) {
        const v = add({ id: 'bg:feat:' + i, group: 'background', label: 'Feat', kind: 'feat', count: f.any, required: true,
          options: featOptions(db, allowed, settings, ['O']) });
        (v || []).forEach(u => { const ft = db.byUid.feat.get(u); if (ft) feats.push({ feat: ft, ctx: 'bg:feat:' + i + ':' + u, origin: 'background' }); });
      } else for (const ref of Object.keys(f)) { const ft = featByRef(db, ref); if (ft) feats.push({ feat: ft, ctx: 'bg:' + ref, origin: 'background', variant: featVariant(ref) }); }
    }
    for (const e of bg.entries || []) if (e && e.name && /feature/i.test(e.name)) features.push({ name: e.name.replace(/^Feature:\s*/i, ''), from: bg.name, kind: 'background', entries: e.entries });
  }

  // ----- classes / levels -----
  const classLevels = {}; // classUid -> level
  const classInfo = []; // order of first appearance
  const spellcasting = []; // per class
  let hp = 0;
  const levelOut = [];
  const totalLevel = (ch.levels || []).length;
  out.totalLevel = totalLevel;
  const pb = profBonus(totalLevel);
  (ch.levels || []).forEach((L, idx) => {
    const cls = db.byUid.class.get(L.classUid);
    if (!cls) { levelOut.push({ index: idx, missing: true }); return; }
    const n = (classLevels[L.classUid] = (classLevels[L.classUid] || 0) + 1);
    const isFirstOverall = idx === 0;
    let info = classInfo.find(c => c.uid === L.classUid);
    if (!info) { info = { uid: L.classUid, cls, level: 0, subclass: null, primary: isFirstOverall }; classInfo.push(info); }
    info.level = n;
    const lid = 'lvl' + idx;
    const lo = { index: idx, charLevel: idx + 1, classUid: L.classUid, className: cls.name, classLevel: n, newFeatures: [], choiceIds: [] };
    levelOut.push(lo);
    const addL = (c) => { c.level = idx + 1; c.levelIndex = idx; lo.choiceIds.push(c.id); return add(c); };
    // HP
    const faces = cls.hd?.faces || 8;
    if (isFirstOverall) hp += faces;
    else hp += L.hpMode === 'roll' && L.hpRoll ? L.hpRoll : Math.floor(faces / 2) + 1;
    // proficiencies
    if (n === 1) {
      if (isFirstOverall) {
        const cs = skillChoiceFromSets(cls.startingProficiencies?.skills);
        cs.fixed.forEach(s => { skillProf.add(s); skillFixed.add(s); });
        cs.chooses.forEach((c, i) => {
          const v = addL({ id: 'class:skill:' + L.classUid + ':' + i, group: 'class', label: cls.name + ' – Skills', kind: 'skill', count: c.count, required: true,
            options: c.from.map(s => ({ value: s, label: s })) });
          (v || []).forEach(s => skillProf.add(s));
        });
        (cls.startingProficiencies?.armor || []).forEach(a => notes.armor.add(stripTags(typeof a === 'string' ? a : a.proficiency || '')));
        (cls.startingProficiencies?.weapons || []).forEach(a => notes.weapons.add(stripTags(typeof a === 'string' ? a : a.proficiency || '')));
        toolChoices(cls.startingProficiencies?.toolProficiencies, 'class', addL, notes);
      } else {
        const pg = cls.multiclassing?.proficienciesGained;
        const cs = skillChoiceFromSets(pg?.skills);
        cs.fixed.forEach(s => { skillProf.add(s); skillFixed.add(s); });
        cs.chooses.forEach((c, i) => {
          const v = addL({ id: 'mc:skill:' + L.classUid + ':' + i, group: 'class', label: cls.name + ' – Skills', kind: 'skill', count: c.count, required: true,
            options: c.from.map(s => ({ value: s, label: s })) });
          (v || []).forEach(s => skillProf.add(s));
        });
        (pg?.armor || []).forEach(a => notes.armor.add(stripTags(typeof a === 'string' ? a : a.proficiency || '')));
        (pg?.weapons || []).forEach(a => notes.weapons.add(stripTags(typeof a === 'string' ? a : a.proficiency || '')));
      }
    }
    // class features at this class level
    for (const ref of cls.classFeatures || []) {
      const r = parseClassFeatureRef(ref);
      if (r.level !== n) continue;
      const f = db.classFeatureMap.get([r.name, r.className, r.classSource, r.level, r.source].map(lc).join('|'));
      const feat = { name: r.name, from: cls.name + ' ' + n, kind: 'class', level: idx + 1, entries: f?.entries };
      if (typeof ref === 'object' && ref.gainSubclassFeature) {
        if (!info.subclassLevel) {
          info.subclassLevel = n;
          const subs = dedupeByName(db.subclasses.filter(s => lc(s.className) === lc(cls.name) && lc(s.classSource || 'PHB') === lc(cls.source) && allowed(s)), cls.source);
          const v = addL({ id: 'sub:' + L.classUid, group: 'class', label: cls.subclassTitle || 'Subclass', kind: 'pick', count: 1, required: true,
            options: subs.map(s => ({ value: subclassUid(s), label: s.name, src: s.source, entity: s })) });
          if (v?.[0]) info.subclass = db.subclassByKey.get(v[0]) || null;
        }
        if (/subclass feature/i.test(r.name)) continue; // placeholder entries
      }
      features.push(feat); lo.newFeatures.push(feat);
      if (/^ability score improvement$/i.test(r.name)) {
        const v = addL({ id: lid + ':asi', group: 'level', label: r.name, kind: 'asiFeat', required: true,
          featOptions: featOptions(db, allowed, settings, settings.rules === '2014' ? null : ['G']) });
        applyAsiFeat(db, v, abilBonus, feats, lid + ':asi');
      }
    }
    // subclass features at this class level
    if (info.subclass) {
      for (const ref of info.subclass.subclassFeatures || []) {
        const r = parseSubclassFeatureRef(ref);
        if (r.level !== n) continue;
        const f = db.subclassFeatureMap.get([r.name, r.className, r.classSource, r.subclassShortName, r.subclassSource, r.level, r.source].map(lc).join('|'));
        const feat = { name: r.name, from: info.subclass.name + ' ' + n, kind: 'subclass', level: idx + 1, entries: f?.entries };
        features.push(feat); lo.newFeatures.push(feat);
      }
    }
    // feat progression (2024)
    for (const fp of cls.featProgression || []) {
      const cnt = fp.progression?.[n] || 0;
      if (!cnt) continue;
      const v = addL({ id: lid + ':fp:' + fp.name, group: 'level', label: fp.name, kind: 'feat', count: cnt, required: true, pool: 'feat',
        options: featOptions(db, allowed, settings, fp.category) });
      (v || []).forEach(u => { const ft = db.byUid.feat.get(u); if (ft) feats.push({ feat: ft, ctx: lid + ':fp:' + u, origin: 'class' }); });
    }
    // weapon mastery (2024): number of known masteries grows with the class level
    const wmProg = cls.weaponMasteryProgression || cls.itemMasteriesProgression;
    if (wmProg) {
      const tot = (lvl) => Object.entries(wmProg).reduce((a, [k, v]) => (Number(k) <= lvl ? v : a), 0);
      const diff = tot(n) - tot(n - 1);
      if (diff > 0) {
        const v = addL({ id: lid + ':wm', group: 'level', label: 'Weapon Mastery', kind: 'pick', count: diff, required: true, pool: 'wm:' + lc(cls.name),
          options: masteryWeapons(db, allowed, cls).map(w => ({ value: uidOf(w), label: w.name, src: w.source, entity: w, prereq: (w.mastery || []).map(m => String(m).split('|')[0]).join(', ') })) });
        (v || []).forEach(u => { const w = db.byUid.item?.get(u) || db.items.find(i => uidOf(i) === u); if (w) { const ff = { name: 'Weapon Mastery: ' + w.name + ' (' + (w.mastery || []).map(m => String(m).split('|')[0]).join(', ') + ')', from: cls.name + ' ' + n, kind: 'optional', level: idx + 1, entries: masteryEntries(db, w) }; features.push(ff); lo.newFeatures.push(ff); } });
      }
    }
    // 2014 ranger: favored enemy / natural explorer are choices written only in the text
    if (lc(cls.name) === 'ranger' && cls.source === 'PHB') {
      if ([1, 6, 14].includes(n)) {
        const types = ['Aberrations', 'Beasts', 'Celestials', 'Constructs', 'Dragons', 'Elementals', 'Fey', 'Fiends', 'Giants', 'Monstrosities', 'Oozes', 'Plants', 'Undead', 'Two humanoid races'];
        const v = addL({ id: lid + ':fe', group: 'level', label: 'Favored Enemy', kind: 'pick', count: 1, required: true, pool: 'ranger:fe', options: types.map(x => ({ value: x, label: x })) });
        (v || []).forEach(x => { const ff = { name: 'Favored Enemy: ' + x, from: cls.name + ' ' + n, kind: 'optional', level: idx + 1 }; features.push(ff); lo.newFeatures.push(ff); });
      }
      if ([1, 6, 10].includes(n)) {
        const ter = ['Arctic', 'Coast', 'Desert', 'Forest', 'Grassland', 'Mountain', 'Swamp', 'Underdark'];
        const v = addL({ id: lid + ':ne', group: 'level', label: 'Natural Explorer', kind: 'pick', count: 1, required: true, pool: 'ranger:ne', options: ter.map(x => ({ value: x, label: x })) });
        (v || []).forEach(x => { const ff = { name: 'Favored Terrain: ' + x, from: cls.name + ' ' + n, kind: 'optional', level: idx + 1 }; features.push(ff); lo.newFeatures.push(ff); });
      }
    }
    // optional features (invocations, fighting styles 2014, ...)
    const ofProgs = [...(cls.optionalfeatureProgression || []), ...((info.subclass?.optionalfeatureProgression) || [])];
    for (const op of ofProgs) {
      const at = (lvl) => Array.isArray(op.progression) ? (op.progression[lvl - 1] || 0) : Object.entries(op.progression || {}).reduce((a, [k, v]) => (Number(k) <= lvl ? a + v : a), 0);
      const diff = at(n) - at(n - 1);
      if (diff <= 0) continue;
      const opts = dedupeByName(db.optionalfeatures.filter(o => allowed(o) && (o.featureType || []).some(ft => op.featureType.includes(ft))), cls.source);
      const pacts = pactNames(db, C);
      const v = addL({ id: lid + ':of:' + op.name, group: 'level', label: op.name, kind: 'pick', count: diff, required: true, pool: 'of:' + op.name,
        options: opts.map(o => ({ value: uidOf(o), label: o.name, src: o.source, entity: o, prereq: optPrereqText(o.prerequisite), unmet: !optPrereqMet(o.prerequisite, n, pacts) })).sort((x, y) => (x.unmet - y.unmet) || x.label.localeCompare(y.label)) });
      (v || []).forEach(u => { const o = db.byUid.optionalfeature.get(u); if (o) { const ff = { name: o.name, from: op.name, kind: 'optional', level: idx + 1, entries: o.entries }; features.push(ff); lo.newFeatures.push(ff); } });
    }
    // spells
    const sc = spellChoicesForLevel(db, allowed, cls, info, n, lid, addL);
    if (sc) lo.spells = sc;
  });
  out.levelOut = levelOut;
  out.classInfo = classInfo;

  // ----- feats (ability + features) -----
  const scoresPre = computeScores(ch, abilBonus);
  for (const { feat, ctx } of feats) {
    for (const [i, set] of (feat.ability || []).entries()) {
      if (set.hidden) continue;
      if (i > 0) break;
      const { fixed, chooses } = abilityFixedAndChoices(set);
      for (const [k, n] of Object.entries(fixed)) abilBonus[k] += n;
      chooses.forEach((c, j) => {
        const v = add({ id: 'featabil:' + ctx + ':' + j, group: 'feat', label: feat.name + ' – Ability +' + c.amount, kind: 'abil', count: c.count, required: true,
          options: c.from.map(a => ({ value: a, label: a })) });
        (v || []).forEach(a => { abilBonus[a] += c.amount; });
      });
    }
    const fs = skillChoiceFromSets(feat.skillProficiencies);
    fs.fixed.forEach(s => { skillProf.add(s); skillFixed.add(s); });
    features.push({ name: feat.name, from: 'Feat', kind: 'feat', entries: feat.entries });
  }

  // ----- extras (outside the rules) -----
  for (const x of ch.extras || []) {
    if (x.type === 'ability' && ABILS.includes(x.ability)) abilBonus[x.ability] += Number(x.amount) || 0;
    if (x.type === 'skill' && SKILLS[x.skill]) { skillProf.add(x.skill); skillFixed.add(x.skill); }
    if (x.type === 'feat') {
      const ft = db.byUid.feat.get(x.uid);
      if (ft) {
        feats.push({ feat: ft, ctx: 'extra:' + x.id, origin: 'extra' });
        const { fixed } = abilityFixedAndChoices((ft.ability || [])[0]);
        for (const [k, n] of Object.entries(fixed)) abilBonus[k] += n;
        features.push({ name: ft.name, from: 'Feat', kind: 'feat', free: true, note: x.note, entries: ft.entries });
      }
    }
    if (x.type === 'feature') features.push({ name: x.name, from: x.note || '', kind: 'extra', free: true, entries: x.text ? [x.text] : [] });
  }

  // ----- final numbers -----
  const scores = computeScores(ch, abilBonus);
  const mods = Object.fromEntries(ABILS.map(a => [a, mod(scores[a])]));
  out.scores = scores; out.mods = mods; out.abilBonus = abilBonus; out.prof = pb;
  // saves: primary class
  const primary = classInfo.find(c => c.primary);
  const saveProf = new Set(primary?.cls.proficiency || []);
  out.saves = Object.fromEntries(ABILS.map(a => [a, { prof: saveProf.has(a), bonus: mods[a] + (saveProf.has(a) ? pb : 0) }]));
  out.skills = Object.fromEntries(Object.entries(SKILLS).map(([k, s]) => {
    const p = skillProf.has(k); const e = expertise.has(k);
    return [k, { prof: p, expertise: e, bonus: mods[s.ab] + (p ? pb : 0) + (e ? pb : 0) }];
  }));
  // HP
  const hasFeat = (n) => feats.some(f => lc(f.feat.name) === lc(n));
  hp += mods.con * totalLevel;
  if (hasFeat('Tough')) hp += 2 * totalLevel;
  for (const x of ch.extras || []) if (x.type === 'hp') hp += Number(x.amount) || 0;
  out.hpMax = Math.max(totalLevel ? 1 : 0, hp);
  // AC
  out.ac = computeAc(db, ch, mods, classInfo);
  out.initiative = mods.dex + (hasFeat('Alert') && settings.rules !== '2014' ? pb : 0) + (hasFeat('Alert') && settings.rules === '2014' ? 5 : 0);
  out.speed = typeof race?.speed === 'number' ? race.speed : (race?.speed?.walk ?? 30);
  out.darkvision = race?.darkvision || 0;
  out.resist = [...notes.resist]; out.languages = [...notes.languages]; out.tools = [...notes.tools];
  out.armorProf = [...notes.armor].filter(Boolean); out.weaponProf = [...notes.weapons].filter(Boolean);
  // ----- spells from species, background and feats (e.g. Magic Initiate, Tiefling legacy) -----
  const bonusSpells = [];
  const spellByRef = (str) => {
    const [nm, src] = String(str).split('#')[0].split('|');
    if (src) { const s = db.byUid.spell.get(lc(nm) + '|' + lc(src)); if (s) return s; }
    const cands = db.spells.filter(x => lc(x.name) === lc(nm));
    return cands.find(x => allowed(x) && x.source === (settings.rules === '2014' ? 'PHB' : 'XPHB')) || cands.find(allowed) || cands[0] || null;
  };
  const spellFilter = (filter) => {
    const f = {}; for (const part of String(filter).split('|')) { const [k, v] = part.split('='); if (k && v != null) f[lc(k)] = v.split(';').map(x => lc(x.trim())); }
    let pool = db.spells;
    if (f.class) {
      const set = new Map();
      for (const cn of f.class) {
        const cls = db.classes.filter(c => lc(c.name) === cn);
        const best = cls.find(c => allowed(c) && c.source === (settings.rules === '2014' ? 'PHB' : 'XPHB')) || cls.find(allowed) || cls[0];
        if (best) for (const sp of classSpellList(db, best)) set.set(uidOf(sp), sp);
      }
      pool = [...set.values()];
    }
    return pool.filter(sp => allowed(sp) && (!f.level || f.level.includes(String(sp.level))) && (!f.school || f.school.includes(lc(sp.school || ''))));
  };
  const applyAdditionalSpells = (sets, from, ctx, group, lvl, variant) => {
    let list = (sets || []).filter(x => x && (x.known || x.innate || x.prepared));
    if (variant) { const m = list.filter(x => lc(x.name || '').startsWith(lc(variant))); if (m.length) list = m; }
    if (!list.length) return;
    let set = list[0];
    if (list.length > 1) {
      const v = add({ id: ctx + ':spellset', group, label: from + ' – Spells', kind: 'pick', count: 1, required: true, options: list.map((x, i) => ({ value: String(i), label: x.name || '#' + (i + 1) })) });
      if (v?.[0] == null) return;
      set = list[Number(v[0])] || list[0];
    }
    let n = 0;
    const walk = (node, top) => {
      if (Array.isArray(node)) {
        for (const e of node) {
          if (typeof e === 'string') { const sp = spellByRef(e); if (sp) bonusSpells.push({ s: sp, from }); continue; }
          const ch2 = e?.choose; if (!ch2) continue;
          const opts = typeof ch2 === 'string' ? spellFilter(ch2) : (ch2.from || []).map(spellByRef).filter(Boolean);
          const cnt = e.count || ch2.count || 1;
          const v = add({ id: ctx + ':spell:' + (n++), group, label: from + ' – ' + (opts.every(o => o.level === 0) ? 'Cantrips' : 'Spells'), kind: 'pick', count: cnt, required: true, spell: true, bonusSpell: true,
            options: opts.map(sp => ({ value: uidOf(sp), label: sp.name, src: sp.source, entity: sp, spellLevel: sp.level })) });
          (v || []).forEach(u => { const sp = db.byUid.spell.get(u); if (sp) bonusSpells.push({ s: sp, from }); });
        }
        return;
      }
      if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { if (top && /^\d+$/.test(k) && Number(k) > lvl) continue; walk(v, false); }
    };
    for (const kind of ['known', 'innate', 'prepared']) walk(set[kind], true);
  };
  if (race && !raceIncomplete) applyAdditionalSpells(race.additionalSpells, race.name, 'race', 'race', totalLevel || 1);
  if (bg) applyAdditionalSpells(bg.additionalSpells, bg.name, 'bg', 'background', totalLevel || 1);
  for (const { feat, ctx, variant } of feats) applyAdditionalSpells(feat.additionalSpells, feat.name + (variant ? ' (' + variant.replace(/\b\w/g, m => m.toUpperCase()) + ')' : ''), 'featspell:' + ctx, 'feat', totalLevel || 1, variant);
  // a spell you already have is not offered again in another spell choice
  const fixedBonus = new Set(); // spells that are not the result of a choice
  { const chosen = new Set(choices.filter(c => c.spell && Array.isArray(c.value)).flatMap(c => c.value)); for (const b of bonusSpells) { const u = uidOf(b.s); if (!chosen.has(u)) fixedBonus.add(u); } }
  const spellChoices = choices.filter(c => c.spell);
  for (const c of spellChoices) {
    const own = new Set(Array.isArray(c.value) ? c.value : []);
    const taken = new Map(); // uid -> name
    for (const b of bonusSpells) { const u = uidOf(b.s); if (fixedBonus.has(u)) taken.set(u, b.s.name); }
    for (const o of spellChoices) if (o !== c && Array.isArray(o.value)) for (const u of o.value) taken.set(u, db.byUid.spell.get(u)?.name || u);
    const left = c.options.filter(o => own.has(o.value) || !taken.has(o.value));
    const dropped = c.options.filter(o => !own.has(o.value) && taken.has(o.value)).map(o => o.label);
    if (left.length >= (c.count || 1)) { c.options = left; if (dropped.length) c.alreadySpells = dropped; }
  }
  // spellcasting summary
  out.spellcasting = spellSummary(db, ch, classInfo, mods, pb, C, levelOut);
  out.spellcasting.bonus = bonusSpells;
  // hide options already chosen in another decision of the same pool
  const pools = {};
  for (const c of choices) if (c.pool && Array.isArray(c.value)) for (const v of c.value) (pools[c.pool] = pools[c.pool] || []).push([c.id, v]);
  for (const c of choices) {
    if (!c.pool || !pools[c.pool]) continue;
    const taken = new Set(pools[c.pool].filter(([id]) => id !== c.id).map(([, v]) => v));
    c.options = c.options.filter(o => !taken.has(o.value) || o.entity?.repeatable);
  }
  // skills: a skill you already get elsewhere (species, background, class, feat) is not offered again
  const skillChoices = choices.filter(c => c.kind === 'skill');
  for (const c of skillChoices) {
    const own = new Set(Array.isArray(c.value) ? c.value : []);
    const elsewhere = new Set(skillFixed);
    for (const o of skillChoices) if (o !== c && Array.isArray(o.value)) o.value.forEach(v => elsewhere.add(v));
    const left = c.options.filter(o => own.has(o.value) || !elsewhere.has(o.value));
    const dropped = c.options.filter(o => !own.has(o.value) && elsewhere.has(o.value)).map(o => o.value);
    if (left.length >= (c.count || 1)) { c.options = left; if (dropped.length) c.already = dropped; }
  }
  // open decisions
  out.open = choices.filter(c => c.required && !isComplete(c));
  out.summary = [race?.name, classInfo.map(c => c.cls.name + ' ' + c.level).join(' / ')].filter(Boolean).join(' · ');
  return out;
}

function computeScores(ch, bonus) {
  const base = ch.base || {};
  return Object.fromEntries(ABILS.map(a => [a, Math.min(30, (Number(base[a]) || 10) + (bonus[a] || 0))]));
}

export function isComplete(c) {
  const v = c.value;
  switch (c.kind) {
    case 'pick': case 'skill': case 'abil': case 'feat': case 'lang':
      return Array.isArray(v) && v.length >= Math.min(c.count || 1, (c.options || []).length || c.count || 1);
    case 'weighted': return v && v.mode != null && Array.isArray(v.abil) && v.abil.filter(Boolean).length === (c.modes[v.mode] || []).length;
    case 'flexAsi': return v && Array.isArray(v.abil) && v.abil.filter(Boolean).length === (v.mode === '111' ? 3 : 2);
    case 'asiFeat':
      if (!v) return false;
      if (v.mode === 'feat') return !!v.feat;
      if (v.mode === 'asi2') return !!v.abil?.[0];
      if (v.mode === 'asi11') return !!(v.abil?.[0] && v.abil?.[1]);
      return false;
    case 'text': return !!(v && String(v).trim());
    default: return v != null;
  }
}

function applyFlexAsi(v, bonus) {
  if (!v || !Array.isArray(v.abil)) return;
  if (v.mode === '111') v.abil.forEach(a => { if (a) bonus[a] += 1; });
  else { if (v.abil[0]) bonus[v.abil[0]] += 2; if (v.abil[1]) bonus[v.abil[1]] += 1; }
}
function applyAsiFeat(db, v, bonus, feats, ctx) {
  if (!v) return;
  if (v.mode === 'asi2' && v.abil?.[0]) bonus[v.abil[0]] += 2;
  if (v.mode === 'asi11') { if (v.abil?.[0]) bonus[v.abil[0]] += 1; if (v.abil?.[1]) bonus[v.abil[1]] += 1; }
  if (v.mode === 'feat' && v.feat) { const ft = db.byUid.feat.get(v.feat); if (ft) feats.push({ feat: ft, ctx: ctx + ':' + v.feat, origin: 'asi' }); }
}

function describeAbilSet(s) {
  return Object.entries(s).map(([k, v]) => k === 'choose' ? `+${v.amount || 1} ×${v.count || 1} (choice)` : `${k.toUpperCase()} +${v}`).join(', ');
}

function mergeSubrace(race, sub) {
  const r = JSON.parse(JSON.stringify(race));
  r.name = race.name + ' (' + sub.name + ')';
  r.__sub = sub.name;
  if (sub.ability) r.ability = (race.ability?.length ? race.ability : [{}]).map(a => ({ ...a, ...mergeAbil(a, sub.ability[0]) }));
  for (const k of ['skillProficiencies', 'languageProficiencies', 'toolProficiencies', 'weaponProficiencies', 'armorProficiencies', 'speed', 'darkvision', 'feats', 'additionalSpells', 'size']) {
    if (sub[k] != null) r[k] = sub[k];
  }
  if (sub.resist) r.resist = [...(race.resist || []), ...sub.resist];
  const entries = [...(r.entries || [])];
  for (const e of sub.entries || []) {
    const ow = e?.data?.overwrite;
    const idx = ow ? entries.findIndex(x => x && x.name === ow) : -1;
    if (idx >= 0) entries[idx] = e; else entries.push(e);
  }
  r.entries = entries;
  return r;
}
function mergeAbil(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) o[k] = k === 'choose' ? v : (o[k] || 0) + v;
  return o;
}

function langChoices(sets, group, add, notes) {
  const set = (sets || [])[0];
  if (!set) return;
  let i = 0;
  for (const [k, v] of Object.entries(set)) {
    if (k === 'anyStandard' || k === 'any' || k === 'anyExotic') {
      const val = add({ id: group + ':lang:' + i++, group, label: 'Language', kind: 'lang', count: v, required: true,
        options: STANDARD_LANGS.map(l => ({ value: l, label: l })) });
      (val || []).forEach(l => notes.languages.add(l));
    } else if (k === 'choose') {
      const val = add({ id: group + ':lang:' + i++, group, label: 'Language', kind: 'lang', count: v.count || 1, required: true,
        options: (v.from || STANDARD_LANGS).map(l => ({ value: l, label: l.replace(/\b\w/g, c => c.toUpperCase()) })) });
      (val || []).forEach(l => notes.languages.add(l));
    } else if (v === true) notes.languages.add(k.replace(/\b\w/g, c => c.toUpperCase()));
  }
}
export const TOOLS = {
  anyArtisansTool: ["Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies", "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools", "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools", "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies", "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools", "Woodcarver's Tools"],
  anyGamingSet: ['Dice Set', 'Dragonchess Set', 'Playing Card Set', 'Three-Dragon Ante Set'],
  anyMusicalInstrument: ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Horn', 'Lute', 'Lyre', 'Pan Flute', 'Shawm', 'Viol'],
  other: ['Disguise Kit', 'Forgery Kit', 'Herbalism Kit', "Navigator's Tools", "Poisoner's Kit", "Thieves' Tools", 'Vehicles (Land)', 'Vehicles (Water)'],
};
const TOOL_LABEL = { anyArtisansTool: "Artisan's Tools", anyGamingSet: 'Gaming Set', anyMusicalInstrument: 'Musical Instrument', any: 'Tool', anyTool: 'Tool' };
const titleCase = (x) => String(x).replace(/\b\w/g, c => c.toUpperCase()).replace(/'S\b/g, "'s");
function toolList(key) {
  if (TOOLS[key]) return TOOLS[key];
  if (key === 'any' || key === 'anyTool') return [...TOOLS.anyArtisansTool, ...TOOLS.anyGamingSet, ...TOOLS.anyMusicalInstrument, ...TOOLS.other];
  return [titleCase(key)];
}
function toolChoices(sets, group, add, notes) {
  const set = (sets || [])[0];
  if (!set) return;
  let i = 0;
  for (const [k, v] of Object.entries(set)) {
    if (v === true) { notes.tools.add(titleCase(k)); continue; }
    let from; let count; let label;
    if (k === 'choose') { from = [...new Set((v.from || []).flatMap(toolList))]; count = v.count || 1; label = 'Tool Proficiency'; }
    else if (typeof v === 'number') { from = toolList(k); count = v; label = 'Tool Proficiency: ' + (TOOL_LABEL[k] || titleCase(k)); }
    else continue;
    const val = add({ id: group + ':tool:' + i++, group, label, kind: 'pick', count, required: true, options: from.map(x => ({ value: x, label: x })) });
    if (Array.isArray(val)) val.forEach(x => notes.tools.add(x));
    else if (typeof val === 'string' && val) notes.tools.add(val); // older saves (free text)
  }
}

export function optPrereqText(pr) {
  const out = [];
  for (const p of pr || []) {
    if (p.level) out.push('Level ' + (typeof p.level === 'object' ? p.level.level : p.level));
    if (p.pact) out.push('Pact of the ' + p.pact);
    if (p.patron) out.push('Patron: ' + p.patron);
    for (const s of p.spell || []) out.push(typeof s === 'string' ? s.split('#')[0].split('|')[0].replace(/\b\w/g, c => c.toUpperCase()) : (s.entry ? stripTags(s.entry) : 'Spell'));
    for (const f of p.feature || []) out.push(String(f).split('|')[0]);
    for (const f of p.optionalfeature || []) out.push(String(f).split('|')[0]);
    if (p.item) out.push(p.item.map(String).join('/'));
    if (p.other) out.push(stripTags(p.other));
    if (p.otherSummary?.entry) out.push(stripTags(p.otherSummary.entry));
  }
  return [...new Set(out)].join(' · ');
}
function optPrereqMet(pr, classLevel, pacts) {
  if (!pr || !pr.length) return true;
  return pr.some(p => {
    const lvl = typeof p.level === 'object' ? p.level?.level : p.level;
    if (lvl && classLevel < lvl) return false;
    if (p.pact && !pacts.has(lc(p.pact))) return false;
    return true;
  });
}
function pactNames(db, C) {
  const s = new Set();
  for (const [k, v] of Object.entries(C)) {
    if (!k.includes(':of:') || !Array.isArray(v)) continue;
    for (const u of v) { const m = /pact of the (\w+)/i.exec(u.split('|')[0]); if (m) s.add(lc(m[1])); }
  }
  return s;
}

function featOptions(db, allowed, settings, categories) {
  const catOk = (f) => {
    if (!categories) return true;
    if (!f.category) return categories.includes('G'); // older uncategorized feats count as general feats
    return categories.some(c => lc(f.category) === lc(c) || lc(f.category).startsWith(lc(c) + ':'));
  };
  return db.feats.filter(f => allowed(f) && catOk(f))
    .map(f => ({ value: uidOf(f), label: f.name, src: f.source, entity: f, prereq: featPrereqText(f) }));
}

function spellChoicesForLevel(db, allowed, cls, info, n, lid, addL) {
  const sub = info.subclass;
  const prog = sub?.casterProgression || cls.casterProgression;
  const host = sub?.casterProgression ? sub : cls;
  if (!prog) return null;
  let listCls = cls;
  if (sub?.casterProgression && !cls.casterProgression) listCls = db.classes.find(c => c.name === 'Wizard' && c.source === cls.source) || db.classes.find(c => c.name === 'Wizard');
  const list = classSpellList(db, listCls).filter(allowed);
  const res = {};
  const can = host.cantripProgression;
  if (can) {
    const d = (can[n - 1] || 0) - (n > 1 ? can[n - 2] || 0 : 0);
    if (d > 0) res.cantrips = addL({ id: lid + ':cantrips:' + info.uid, group: 'level', label: cls.name + ' – Cantrips', kind: 'pick', count: d, required: true, spell: true, pool: 'spell:' + info.uid,
      options: list.filter(s => s.level === 0).map(s => ({ value: uidOf(s), label: s.name, src: s.source, entity: s, spellLevel: 0 })) });
  }
  const maxL = maxSpellLevelFor(prog, n);
  let d = 0;
  const known = host.spellsKnownProgression || host.preparedSpellsProgression;
  if (known) d = (known[n - 1] || 0) - (n > 1 ? known[n - 2] || 0 : 0);
  else if (host.spellsKnownProgressionFixed) d = host.spellsKnownProgressionFixed[n - 1] || 0;
  if (d > 0 && maxL > 0) {
    res.spells = addL({ id: lid + ':spells:' + info.uid, group: 'level', label: cls.name + ' – ' + (host.spellsKnownProgressionFixed ? 'Spellbook' : 'Spells'), kind: 'pick', count: d, required: true, spell: true, pool: 'spell:' + info.uid,
      options: list.filter(s => s.level > 0 && s.level <= maxL).map(s => ({ value: uidOf(s), label: s.name, src: s.source, entity: s, spellLevel: s.level })) });
  }
  if (host.preparedSpells && !host.spellsKnownProgressionFixed) info.preparedFormula = host.preparedSpells;
  return res;
}

function spellSummary(db, ch, classInfo, mods, pb, C, levelOut) {
  const out = { classes: [], slots: [], pact: null };
  let casterSum = 0; let casterCount = 0;
  for (const info of classInfo) {
    const host = info.subclass?.casterProgression ? info.subclass : info.cls;
    const prog = host.casterProgression;
    if (!prog) continue;
    const ab = host.spellcastingAbility || info.cls.spellcastingAbility;
    const spells = []; const cantrips = [];
    for (const lo of levelOut) {
      if (lo.classUid !== info.uid) continue;
      for (const id of ['lvl' + lo.index + ':cantrips:' + info.uid, 'lvl' + lo.index + ':spells:' + info.uid]) {
        for (const u of C[id] || []) { const s = db.byUid.spell.get(u); if (s) (s.level === 0 ? cantrips : spells).push(s); }
      }
    }
    // subclass / class always-prepared spells
    const always = [];
    for (const src of [info.cls, info.subclass]) {
      for (const as of src?.additionalSpells || []) {
        for (const kind of ['prepared', 'known']) {
          for (const [lvl, arr] of Object.entries(as[kind] || {})) {
            if (Number(lvl.replace(/\D/g, '')) <= info.level && Array.isArray(arr)) arr.forEach(x => { if (typeof x === 'string') always.push(x.split('#')[0].split('|')[0]); });
          }
        }
      }
    }
    let prepared = null;
    if (info.preparedFormula && ab) {
      const f = info.preparedFormula.replace(/<\$level\$>/g, info.level).replace(/<\$(\w+)_mod\$>/g, (_m, a) => mods[a] ?? 0);
      try { prepared = Math.max(1, Math.floor(Function('return (' + f.replace(/[^0-9+\-*/(). ]/g, '') + ')')())); } catch { prepared = null; }
    }
    out.classes.push({ name: info.cls.name, ability: ab, dc: ab ? 8 + pb + mods[ab] : null, attack: ab ? pb + mods[ab] : null, cantrips, spells, always, prepared, prog });
    if (prog === 'pact') { const p = PACT[Math.min(20, info.level)]; out.pact = { count: p[0], level: p[1] }; }
    else { casterSum += casterLevel(prog, info.level); casterCount++; }
  }
  if (casterCount) {
    // multiclass: half casters round down when combined (2014/2024 rule), single class uses own progression
    let cl = casterSum;
    if (casterCount === 1) {
      const only = classInfo.find(i => (i.subclass?.casterProgression || i.cls.casterProgression) && (i.subclass?.casterProgression || i.cls.casterProgression) !== 'pact');
      cl = casterLevel(only.subclass?.casterProgression || only.cls.casterProgression, only.level);
    }
    out.slots = FULL_SLOTS[Math.min(20, cl)] || [];
  }
  return out;
}

function computeAc(db, ch, mods, classInfo) {
  let armor = null; let shield = false; let magicBonus = 0;
  for (const it of ch.inventory || []) {
    if (!it.equipped) continue;
    const e = it.uid ? db.byUid.item.get(it.uid) : null;
    const type = String(e?.type || '').split('|')[0];
    if (['LA', 'MA', 'HA'].includes(type)) armor = e;
    if (type === 'S') shield = true;
    if (e?.bonusAc) magicBonus += Number(e.bonusAc) || 0;
  }
  let ac;
  if (armor) {
    const t = String(armor.type).split('|')[0];
    const base = Number(armor.ac) || 10;
    ac = t === 'LA' ? base + mods.dex : t === 'MA' ? base + Math.min(2, mods.dex) : base;
  } else {
    ac = 10 + mods.dex;
    if (classInfo.some(c => c.cls.name === 'Barbarian')) ac = Math.max(ac, 10 + mods.dex + mods.con);
    if (!shield && classInfo.some(c => c.cls.name === 'Monk')) ac = Math.max(ac, 10 + mods.dex + mods.wis);
  }
  if (shield) ac += 2;
  for (const x of ch.extras || []) if (x.type === 'ac') ac += Number(x.amount) || 0;
  return ac + magicBonus;
}

// Same-named entries (e.g. a 2014 subclass re-listed for a 2024 class): keep the one from the preferred source / newest edition
export function dedupeByName(list, preferSource) {
  const best = new Map();
  for (const e of list) {
    const k = lc(e.name);
    const cur = best.get(k);
    const score = (x) => (lc(x.source) === lc(preferSource) ? 4 : 0) + (x.edition === 'one' ? 2 : 0) + (x.reprintedAs ? -1 : 0);
    if (!cur || score(e) > score(cur)) best.set(k, e);
  }
  return list.filter(e => best.get(lc(e.name)) === e);
}

// ---------- class helpers for UI ----------
export function multiclassReq(cls) {
  const r = cls.multiclassing?.requirements;
  if (r) return r;
  if (cls.primaryAbility?.length) {
    const groups = cls.primaryAbility.map(o => Object.fromEntries(Object.keys(o).map(k => [k, 13])));
    return groups.length === 1 ? groups[0] : { or: groups };
  }
  return null;
}
export function meetsReq(req, scores) {
  if (!req) return true;
  if (req.or) return req.or.some(r => meetsReq(r, scores));
  return Object.entries(req).every(([k, v]) => k === 'or' || (scores[k] || 0) >= v);
}
export function reqText(req) {
  if (!req) return '';
  if (req.or) return req.or.map(reqText).join(' / ');
  return Object.entries(req).map(([k, v]) => k.toUpperCase() + ' ' + v).join(' + ');
}

// ---------- starting equipment ----------
export function equipmentGroups(db, ent) {
  const se = ent?.startingEquipment;
  const data = Array.isArray(se) ? se : se?.defaultData;
  if (!Array.isArray(data)) return [];
  return data.map(g => {
    const opts = Object.entries(g).map(([k, list]) => ({ key: k, fixed: k === '_', items: list.map(x => equipItem(db, x)) }));
    return opts;
  });
}
function equipItem(db, x) {
  if (typeof x === 'string') return { uid: lc(x.split('|')[0]) + '|' + lc(x.split('|')[1] || 'phb'), name: itemName(db, x), qty: 1 };
  if (x.item) return { uid: lc(x.item.split('|')[0]) + '|' + lc(x.item.split('|')[1] || 'phb'), name: x.displayName || itemName(db, x.item), qty: x.quantity || 1, containsValue: x.containsValue };
  if (x.value != null) return { gold: x.value / 100, name: (x.value / 100) + ' GP' };
  if (x.special) return { name: x.special, qty: x.quantity || 1 };
  if (x.equipmentType) return { name: ({ weaponSimple: 'Simple weapon', weaponMartial: 'Martial weapon', weaponSimpleMelee: 'Simple melee weapon', weaponMartialMelee: 'Martial melee weapon', instrumentMusical: 'Musical instrument', setGaming: 'Gaming set', toolArtisan: "Artisan's tools", focusSpellcastingArcane: 'Arcane focus', focusSpellcastingHoly: 'Holy symbol', focusSpellcastingDruidic: 'Druidic focus' })[x.equipmentType] || x.equipmentType, qty: x.quantity || 1, generic: true };
  return { name: JSON.stringify(x), qty: 1 };
}
