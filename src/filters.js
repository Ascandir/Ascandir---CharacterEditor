// Facet filters for race / background / class lists (in the style of 5e.tools)
const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const FEAT_CATS = { G: 'General', O: 'Origin', FS: 'Fighting Style', 'FS:P': 'Fighting Style (Paladin)', 'FS:R': 'Fighting Style (Ranger)', EB: 'Epic Boon', DG: 'Dark Gift' };

const title = s => String(s).replace(/(^|[\s(\-\/])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(Of|The|And|To|In)\b/g, m => m.toLowerCase()).replace(/^./, m => m.toUpperCase());
const nameOf = key => {
  const n = String(key).split('|')[0];
  const [a, b] = n.split(';').map(x => x.trim());
  return title(b ? `${a} (${b})` : a);
};

function abilities(e) {
  const out = new Set();
  for (const a of [].concat(e.ability || [])) {
    if (!a || typeof a !== 'object') continue;
    for (const k of ABILS) if (a[k]) out.add(k);
    const ch = a.choose;
    if (ch) for (const c of [].concat(ch)) {
      for (const k of (c.from || c.weighted?.from || [])) if (ABILS.includes(k)) out.add(k);
    }
  }
  return [...out];
}

// generic proficiency blocks: [{key:true}, {choose:{from:[..]}}, {any:2}, {anyStandard:1}]
function profs(arr, anyLabel = 'Any') {
  const out = new Set();
  for (const o of [].concat(arr || [])) {
    if (!o || typeof o !== 'object') continue;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'choose') for (const c of [].concat(v)) for (const f of (c.from || [])) out.add(title(typeof f === 'string' ? f.split('|')[0] : f.name || ''));
      else if (/^any/i.test(k)) out.add(anyLabel);
      else if (v) out.add(title(k.split('|')[0]));
    }
  }
  out.delete('');
  return [...out];
}

function feats(e) {
  const out = new Set();
  for (const o of [].concat(e.feats || [])) {
    if (!o || typeof o !== 'object') continue;
    for (const [k, v] of Object.entries(o)) {
      if (k === 'anyFromCategory') for (const c of [].concat(v.category || [])) out.add('Any ' + (FEAT_CATS[c] || c) + ' feat');
      else if (k === 'any') out.add('Any feat');
      else if (v) out.add(nameOf(k));
    }
  }
  return [...out];
}

function resists(list) {
  const out = new Set();
  for (const r of [].concat(list || [])) {
    if (typeof r === 'string') out.add(title(r));
    else if (r?.choose?.from) r.choose.from.forEach(x => out.add(title(x)));
  }
  return [...out];
}

function speeds(e) {
  const s = e.speed; const out = [];
  if (s && typeof s === 'object') for (const k of ['fly', 'swim', 'climb', 'burrow']) if (s[k]) out.push(k);
  return out;
}

const sizeName = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Varies' };

function spellsOf(e) {
  return (e.additionalSpells && e.additionalSpells.length) ? ['yes'] : ['no'];
}

export function facetDefs(kind) {
  if (kind === 'background') return [
    { id: 'ability', get: abilities, label: 'fAbility', fmt: 'abil' },
    { id: 'feat', get: feats, label: 'fFeat' },
    { id: 'skill', get: e => profs(e.skillProficiencies), label: 'fSkill' },
    { id: 'tool', get: e => profs(e.toolProficiencies), label: 'fTool' },
    { id: 'lang', get: e => profs(e.languageProficiencies), label: 'fLang' },
    { id: 'spells', get: spellsOf, label: 'fSpells', fmt: 'yesno' },
    { id: 'source', get: e => [e.source], label: 'fSource', fmt: 'source' },
  ];
  if (kind === 'race') return [
    { id: 'ability', get: abilities, label: 'fAbility', fmt: 'abil' },
    { id: 'size', get: e => [].concat(e.size || []).map(s => sizeName[s] || s), label: 'fSize' },
    { id: 'speed', get: speeds, label: 'fSpeed', fmt: 'speed' },
    { id: 'darkvision', get: e => [e.darkvision ? e.darkvision + ' ft' : 'none'], label: 'fDarkvision', fmt: 'none' },
    { id: 'resist', get: e => resists(e.resist), label: 'fResist' },
    { id: 'type', get: e => [].concat(e.creatureTypes || ['humanoid']).map(title), label: 'fType' },
    { id: 'trait', get: e => [].concat(e.traitTags || []), label: 'fTrait' },
    { id: 'skill', get: e => profs(e.skillProficiencies), label: 'fSkill' },
    { id: 'lang', get: e => profs(e.languageProficiencies), label: 'fLang' },
    { id: 'spells', get: spellsOf, label: 'fSpells', fmt: 'yesno' },
    { id: 'feat', get: feats, label: 'fFeat' },
    { id: 'source', get: e => [e.source], label: 'fSource', fmt: 'source' },
  ];
  if (kind === 'class') return [
    { id: 'hd', get: e => e.hd?.faces ? ['d' + e.hd.faces] : [], label: 'fHitDie' },
    { id: 'primary', get: e => { const s = new Set(); for (const o of [].concat(e.primaryAbility || [])) for (const k of Object.keys(o || {})) if (ABILS.includes(k)) s.add(k); return [...s]; }, label: 'fPrimary', fmt: 'abil' },
    { id: 'caster', get: e => [e.spellcastingAbility ? (e.casterProgression || 'yes') : 'no'], label: 'fCaster', fmt: 'caster' },
    { id: 'save', get: e => [].concat(e.proficiency || []).filter(k => ABILS.includes(k)), label: 'fSave', fmt: 'abil' },
    { id: 'source', get: e => [e.source], label: 'fSource', fmt: 'source' },
  ];
  return [];
}

const ORDER = { abil: ABILS, yesno: ['yes', 'no'] };

// Build available values per facet from a list
export function buildFacets(kind, list) {
  return facetDefs(kind).map(f => {
    const vals = new Map();
    for (const e of list) for (const v of f.get(e)) vals.set(v, (vals.get(v) || 0) + 1);
    let keys = [...vals.keys()];
    const ord = ORDER[f.fmt];
    keys.sort((a, b) => ord ? ord.indexOf(a) - ord.indexOf(b) : (a === 'none' || /^Any/.test(a) ? -1 : 0) - (b === 'none' || /^Any/.test(b) ? -1 : 0) || String(a).localeCompare(String(b), undefined, { numeric: true }));
    return { ...f, values: keys.map(v => ({ v, n: vals.get(v) })) };
  }).filter(f => f.values.length > 1 || (f.values.length === 1 && f.values[0].n < list.length));
}

// state: { [facetId]: { vals: { [value]: 1 | 2 }, and: bool } }  1 = include, 2 = exclude
export function applyFacets(kind, list, state) {
  const defs = facetDefs(kind).filter(f => state[f.id] && Object.keys(state[f.id].vals || {}).length);
  if (!defs.length) return list;
  return list.filter(e => defs.every(f => {
    const st = state[f.id]; const have = new Set(f.get(e));
    const inc = Object.entries(st.vals).filter(([, s]) => s === 1).map(([v]) => v);
    const exc = Object.entries(st.vals).filter(([, s]) => s === 2).map(([v]) => v);
    if (exc.some(v => have.has(v))) return false;
    if (!inc.length) return true;
    return st.and ? inc.every(v => have.has(v)) : inc.some(v => have.has(v));
  }));
}

export function activeCount(state) {
  return Object.values(state).reduce((n, s) => n + Object.keys(s.vals || {}).length, 0);
}
