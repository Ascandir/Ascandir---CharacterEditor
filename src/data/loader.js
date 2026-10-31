// Loads and prepares 5e.tools data (official + selected homebrew).
import { api } from '../platform.js';

export const DATA_BASE = 'https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/';
export const HB_BASE = 'https://raw.githubusercontent.com/TheGiddyLimit/homebrew/master/';

const TYPES = ['race', 'subrace', 'background', 'feat', 'optionalfeature', 'baseitem', 'item', 'class', 'subclass',
  'classFeature', 'subclassFeature', 'spell', 'itemMastery'];
export const HB_PROPS = ['race', 'subrace', 'class', 'subclass', 'spell', 'feat', 'background', 'optionalfeature', 'item', 'baseitem'];

export const lc = (s) => String(s ?? '').toLowerCase();
export const uidOf = (e) => lc(e.name) + '|' + lc(e.source);
const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

async function getJson(url, force) {
  const r = await api.fetchData(url, { force });
  return JSON.parse(r.text);
}

// ---------- _mod handling (subset of 5e.tools copy rules) ----------
function matchName(it, name) {
  if (typeof it === 'string') return lc(it) === lc(name);
  return it && lc(it.name) === lc(name);
}
function applyModOp(target, prop, op) {
  const arr = () => { if (!Array.isArray(target[prop])) target[prop] = target[prop] == null ? [] : [target[prop]]; return target[prop]; };
  const items = op.items == null ? [] : (Array.isArray(op.items) ? op.items : [op.items]);
  switch (op.mode) {
    case 'appendArr': arr().push(...clone(items)); break;
    case 'prependArr': arr().unshift(...clone(items)); break;
    case 'insertArr': arr().splice(op.index ?? 0, 0, ...clone(items)); break;
    case 'replaceArr': {
      const a = arr();
      let idx = -1;
      if (op.replace && typeof op.replace === 'object' && op.replace.index != null) idx = op.replace.index;
      else idx = a.findIndex(it => matchName(it, op.replace));
      if (idx >= 0) a.splice(idx, 1, ...clone(items));
      break;
    }
    case 'replaceOrAppendArr': {
      const a = arr();
      const idx = a.findIndex(it => matchName(it, op.replace));
      if (idx >= 0) a.splice(idx, 1, ...clone(items)); else a.push(...clone(items));
      break;
    }
    case 'removeArr': {
      const names = op.names == null ? [] : (Array.isArray(op.names) ? op.names : [op.names]);
      const a = arr();
      target[prop] = a.filter(it => !names.some(n => matchName(it, n)));
      if (op.items) target[prop] = target[prop].filter(it => !items.some(x => JSON.stringify(x) === JSON.stringify(it)));
      break;
    }
    case 'replaceTxt': {
      if (target[prop] == null) break;
      const re = new RegExp(op.replace, op.flags || 'g');
      const walk = (v) => typeof v === 'string' ? v.replace(re, op.with) : Array.isArray(v) ? v.map(walk)
        : (v && typeof v === 'object') ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'type' ? x : walk(x)])) : v;
      target[prop] = walk(target[prop]);
      break;
    }
    default: break;
  }
}
function applyMod(target, mod) {
  if (!mod) return;
  for (const [prop, ops] of Object.entries(mod)) {
    if (prop === '_') continue;
    const list = Array.isArray(ops) ? ops : [ops];
    for (const op of list) {
      if (typeof op === 'string') { if (op === 'remove') delete target[prop]; continue; }
      if (prop === '*') { for (const k of Object.keys(target)) if (Array.isArray(target[k])) applyModOp(target, k, op); continue; }
      applyModOp(target, prop, op);
    }
  }
}

function copyKey(type, c) {
  if (type === 'subrace') return lc(c.name) + '|' + lc(c.source) + '|' + lc(c.raceName) + '|' + lc(c.raceSource);
  if (type === 'subclass') return lc(c.shortName || c.name) + '|' + lc(c.source) + '|' + lc(c.className) + '|' + lc(c.classSource);
  return lc(c.name) + '|' + lc(c.source);
}
function entKey(type, e) {
  if (type === 'subrace') return lc(e.name) + '|' + lc(e.source) + '|' + lc(e.raceName) + '|' + lc(e.raceSource);
  if (type === 'subclass') return lc(e.shortName || e.name) + '|' + lc(e.source) + '|' + lc(e.className) + '|' + lc(e.classSource);
  return lc(e.name) + '|' + lc(e.source);
}

function resolveCopies(type, list) {
  const map = new Map();
  for (const e of list) map.set(entKey(type, e), e);
  if (type === 'subclass') for (const e of list) map.set(lc(e.name) + '|' + lc(e.source) + '|' + lc(e.className) + '|' + lc(e.classSource), e);
  const resolving = new Set();
  const resolve = (e) => {
    if (!e._copy) return e;
    if (resolving.has(e)) return e;
    resolving.add(e);
    const base = map.get(copyKey(type, e._copy));
    if (!base) { delete e._copy; return e; }
    resolve(base);
    const merged = clone(base);
    for (const k of ['reprintedAs', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'page', 'otherSources', 'hasFluff', 'hasFluffImages', '_versions']) delete merged[k];
    const own = { ...e }; const cp = own._copy; delete own._copy;
    Object.assign(merged, own);
    applyMod(merged, cp._mod);
    for (const k of Object.keys(e)) delete e[k];
    Object.assign(e, merged);
    return e;
  };
  for (const e of list) resolve(e);
  return list;
}

// ---------- race versions ----------
function fillVars(obj, vars) {
  let s = JSON.stringify(obj);
  for (const [k, v] of Object.entries(vars || {})) s = s.split('{{' + k + '}}').join(String(v).replace(/"/g, '\\"'));
  return JSON.parse(s);
}
function expandVersions(race) {
  const out = [];
  for (const v of race._versions || []) {
    const defs = v._abstract ? (v._implementations || []).map(impl => {
      const vars = impl._variables || {};
      const merged = Object.assign(clone(v._abstract), clone(impl));
      delete merged._variables;
      return fillVars(merged, vars);
    }) : [clone(v)];
    for (const d of defs) {
      const ent = clone(race);
      delete ent._versions; delete ent.reprintedAs;
      const mod = d._mod; delete d._mod;
      Object.assign(ent, d);
      applyMod(ent, mod);
      ent.__parent = uidOf(race);
      out.push(ent);
    }
  }
  return out;
}

// ---------- main load ----------
export async function loadOfficial(onProgress, force = false) {
  const step = (m) => onProgress && onProgress(m);
  const raw = Object.fromEntries(TYPES.map(t => [t, []]));
  const push = (obj, origin) => {
    for (const t of TYPES) if (Array.isArray(obj[t])) for (const e of obj[t]) { e.__origin = origin; raw[t].push(e); }
  };
  step('books');
  const [books, adventures] = await Promise.all([getJson(DATA_BASE + 'books.json', force), getJson(DATA_BASE + 'adventures.json', force).catch(() => ({ adventure: [] }))]);
  step('races, backgrounds, feats');
  const simple = ['races.json', 'backgrounds.json', 'feats.json', 'optionalfeatures.json', 'items-base.json', 'items.json'];
  const simpleData = await Promise.all(simple.map(f => getJson(DATA_BASE + f, force)));
  simpleData.forEach(d => push(d, 'official'));
  step('classes');
  const classIdx = await getJson(DATA_BASE + 'class/index.json', force);
  const classData = await Promise.all(Object.values(classIdx).map(f => getJson(DATA_BASE + 'class/' + f, force)));
  classData.forEach(d => push(d, 'official'));
  step('spells');
  const spellIdx = await getJson(DATA_BASE + 'spells/index.json', force);
  const spellData = await Promise.all(Object.values(spellIdx).map(f => getJson(DATA_BASE + 'spells/' + f, force)));
  spellData.forEach(d => push(d, 'official'));
  const spellLookup = await getJson(DATA_BASE + 'generated/gendata-spell-source-lookup.json', force);
  const sourceMeta = {};
  for (const b of books.book || []) sourceMeta[b.source || b.id] = { name: b.name, group: b.group || 'other', published: b.published };
  for (const a of adventures.adventure || []) if (!sourceMeta[a.source || a.id]) sourceMeta[a.source || a.id] = { name: a.name, group: 'adventure', published: a.published };
  return { raw, spellLookup, sourceMeta, loadedAt: Date.now() };
}

export async function loadHomebrewIndex(force = false) {
  const [props, meta] = await Promise.all([
    getJson(HB_BASE + '_generated/index-props.json', force),
    getJson(HB_BASE + '_generated/index-meta.json', force).catch(() => ({})),
  ]);
  const files = new Map();
  for (const p of HB_PROPS) {
    for (const path of Object.keys(props[p] || {})) {
      if (!files.has(path)) files.set(path, { path, props: [] });
      files.get(path).props.push(p);
    }
  }
  const list = [...files.values()].map(f => {
    const fname = f.path.split('/').pop();
    const m = meta[fname] || {};
    return { ...f, title: fname.replace(/\.json$/, ''), authors: m.a || [] };
  });
  list.sort((a, b) => a.title.localeCompare(b.title));
  return list;
}

export async function loadHomebrewFile(path, force = false) {
  const url = HB_BASE + path.split('/').map(encodeURIComponent).join('/');
  return getJson(url, force);
}

// Build the indexed database from official raw data + homebrew json objects
export function buildDb(official, homebrewJsons = []) {
  const raw = Object.fromEntries(TYPES.map(t => [t, (official.raw[t] || []).map(e => clone(e))]));
  const sourceMeta = { ...official.sourceMeta };
  for (const hb of homebrewJsons) {
    for (const s of hb.json?._meta?.sources || []) {
      sourceMeta[s.json] = { name: s.full || s.json, group: 'homebrew', abbr: s.abbreviation, hbPath: hb.path };
    }
    for (const t of TYPES) if (Array.isArray(hb.json?.[t])) for (const e of hb.json[t]) { const c = clone(e); c.__origin = 'homebrew'; raw[t].push(c); }
  }
  for (const t of TYPES) resolveCopies(t, raw[t]);

  const db = { sourceMeta, spellLookup: official.spellLookup };
  // races with versions + subraces
  const races = [];
  for (const r of raw.race) {
    if (r._versions) { r.__versions = expandVersions(r); delete r._versions; }
    races.push(r);
  }
  db.races = races;
  db.subraces = raw.subrace;
  db.backgrounds = raw.background;
  db.feats = raw.feat;
  db.optionalfeatures = raw.optionalfeature;
  db.items = [...raw.baseitem.map(i => ({ ...i, __base: true })), ...raw.item];
  db.itemMasteries = raw.itemMastery || [];
  db.classes = raw.class.filter(c => !c.isSidekick && c.name !== 'Sidekick');
  db.subclasses = raw.subclass;
  db.spells = raw.spell;
  db.classFeatureMap = new Map();
  for (const f of raw.classFeature) db.classFeatureMap.set([f.name, f.className, f.classSource || 'PHB', f.level, f.source].map(lc).join('|'), f);
  db.subclassFeatureMap = new Map();
  for (const f of raw.subclassFeature) db.subclassFeatureMap.set([f.name, f.className, f.classSource || 'PHB', f.subclassShortName, f.subclassSource || 'PHB', f.level, f.source].map(lc).join('|'), f);
  db.byUid = {};
  for (const [k, list] of Object.entries({ race: races, background: db.backgrounds, feat: db.feats, optionalfeature: db.optionalfeatures, item: db.items, class: db.classes, spell: db.spells })) {
    const m = new Map();
    for (const e of list) { if (!m.has(uidOf(e))) m.set(uidOf(e), e); }
    db.byUid[k] = m;
  }
  for (const r of races) for (const v of r.__versions || []) db.byUid.race.set(uidOf(v), v);
  db.subclassByKey = new Map(db.subclasses.map(s => [subclassUid(s), s]));
  // source counts
  const counts = {};
  const count = (e) => { counts[e.source] = (counts[e.source] || 0) + 1; };
  [races, db.subraces, db.backgrounds, db.feats, db.classes, db.subclasses, db.spells, db.items].forEach(l => l.forEach(count));
  db.sourceCounts = counts;
  return db;
}

export function subclassUid(s) { return [s.shortName || s.name, s.source, s.className, s.classSource || 'PHB'].map(lc).join('|'); }

export function parseClassFeatureRef(ref) {
  const p = (typeof ref === 'string' ? ref : ref.classFeature).split('|');
  return { name: p[0], className: p[1], classSource: p[2] || 'PHB', level: Number(p[3]), source: p[4] || p[2] || 'PHB' };
}
export function parseSubclassFeatureRef(ref) {
  const p = (typeof ref === 'string' ? ref : ref.subclassFeature).split('|');
  return { name: p[0], className: p[1], classSource: p[2] || 'PHB', subclassShortName: p[3], subclassSource: p[4] || 'PHB', level: Number(p[5]), source: p[6] || p[4] || 'PHB' };
}

export function sourceGroup(db, src) {
  const g = db.sourceMeta[src]?.group;
  if (!g) return 'other';
  if (g === 'core') return 'core';
  if (g.startsWith('supplement')) return 'supplement';
  if (g.startsWith('setting')) return 'setting';
  if (g === 'homebrew') return 'homebrew';
  return 'other';
}
