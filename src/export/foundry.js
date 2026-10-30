// Export a character as a Foundry VTT dnd5e actor (use "Import Data" on an actor in Foundry).
// Uses field shapes that current dnd5e versions accept or migrate automatically.
import { stripTags, equipmentGroups } from '../engine/rules.js';
import { lc } from '../data/loader.js';
import { ABILS } from '../i18n.js';

const SKILL_KEYS = {
  acrobatics: 'acr', 'animal handling': 'ani', arcana: 'arc', athletics: 'ath', deception: 'dec', history: 'his', insight: 'ins',
  intimidation: 'itm', investigation: 'inv', medicine: 'med', nature: 'nat', perception: 'prc', performance: 'prf', persuasion: 'per',
  religion: 'rel', 'sleight of hand': 'slt', stealth: 'ste', survival: 'sur',
};
const SCHOOL = { A: 'abj', C: 'con', D: 'div', E: 'enc', V: 'evo', I: 'ill', N: 'nec', T: 'trs' };
const DMG = { A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder' };
const WPROP = { V: 'ver', F: 'fin', L: 'lgt', T: 'thr', H: 'hvy', '2H': 'two', A: 'amm', LD: 'lod', R: 'rch', S: 'spc' };
const PROG = { full: 'full', '1/2': 'half', '1/3': 'third', pact: 'pact', artificer: 'artificer' };
const TOOL_KEYS = {
  "alchemist's supplies": 'alchemist', "brewer's supplies": 'brewer', "calligrapher's supplies": 'calligrapher', "carpenter's tools": 'carpenter',
  "cartographer's tools": 'cartographer', "cobbler's tools": 'cobbler', "cook's utensils": 'cook', "glassblower's tools": 'glassblower',
  "jeweler's tools": 'jeweler', "leatherworker's tools": 'leatherworker', "mason's tools": 'mason', "painter's supplies": 'painter',
  "potter's tools": 'potter', "smith's tools": 'smith', "tinker's tools": 'tinker', "weaver's tools": 'weaver', "woodcarver's tools": 'woodcarver',
  'dice set': 'dice', 'playing card set': 'card', 'dragonchess set': 'chess', 'three-dragon ante set': 'card',
  bagpipes: 'bagpipes', drum: 'drum', dulcimer: 'dulcimer', flute: 'flute', horn: 'horn', lute: 'lute', lyre: 'lyre', 'pan flute': 'panflute', shawm: 'shawm', viol: 'viol',
  'disguise kit': 'disg', 'forgery kit': 'forg', 'herbalism kit': 'herb', "navigator's tools": 'navg', "poisoner's kit": 'pois', "thieves' tools": 'thief',
};
const LANG_KEYS = { common: 'common', 'common sign language': 'sign', draconic: 'draconic', dwarvish: 'dwarvish', elvish: 'elvish', giant: 'giant', gnomish: 'gnomish', goblin: 'goblin', halfling: 'halfling', orc: 'orc', abyssal: 'abyssal', celestial: 'celestial', 'deep speech': 'deep', druidic: 'druidic', infernal: 'infernal', primordial: 'primordial', sylvan: 'sylvan', "thieves' cant": 'cant', 'thieves’ cant': 'cant', undercommon: 'undercommon' };

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function entriesToHtml(e) {
  if (e == null) return '';
  if (typeof e === 'string') return '<p>' + esc(stripTags(e)) + '</p>';
  if (Array.isArray(e)) return e.map(entriesToHtml).join('');
  if (e.type === 'list') return '<ul>' + (e.items || []).map(it => '<li>' + (typeof it === 'string' ? esc(stripTags(it)) : (it.name ? '<strong>' + esc(stripTags(it.name)) + '</strong> ' : '') + (it.entry ? esc(stripTags(it.entry)) : entriesToHtml(it.entries).replace(/<\/?p>/g, ' '))) + '</li>').join('') + '</ul>';
  if (e.type === 'table') {
    const head = e.colLabels ? '<tr>' + e.colLabels.map(c => '<th>' + esc(stripTags(c)) + '</th>').join('') + '</tr>' : '';
    const rows = (e.rows || []).map(r => '<tr>' + (Array.isArray(r) ? r : r.row || []).map(c => '<td>' + esc(stripTags(typeof c === 'object' ? (c?.entry ?? (c?.roll ? (c.roll.exact ?? c.roll.min + '–' + c.roll.max) : '')) : String(c))) + '</td>').join('') + '</tr>').join('');
    return '<table>' + head + rows + '</table>';
  }
  const name = e.name ? '<h4>' + esc(stripTags(e.name)) + '</h4>' : '';
  return name + entriesToHtml(e.entries || e.entry || []);
}

const ident = (s) => lc(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function spellItem(s, { method = 'spell', prepared = 1 } = {}) {
  const props = [];
  if (s.components?.v) props.push('vocal');
  if (s.components?.s) props.push('somatic');
  if (s.components?.m) props.push('material');
  if ((s.duration || []).some(d => d.concentration)) props.push('concentration');
  if (s.meta?.ritual) props.push('ritual');
  const t = (s.time || [])[0] || {};
  const actType = { action: 'action', bonus: 'bonus', reaction: 'reaction', minute: 'minute', hour: 'hour', round: 'action' }[t.unit] || 'special';
  const d = (s.duration || [])[0] || {};
  const dur = d.type === 'instant' ? { units: 'inst' } : d.type === 'permanent' ? { units: 'perm' } : d.type === 'timed'
    ? { value: String(d.duration?.amount ?? ''), units: { round: 'round', minute: 'minute', hour: 'hour', day: 'day', week: 'week', month: 'month', year: 'year' }[d.duration?.type] || 'spec' } : { units: 'spec' };
  const dist = s.range?.distance || {};
  const range = dist.type === 'self' ? { units: 'self' } : dist.type === 'touch' ? { units: 'touch' } : dist.type === 'feet' ? { value: String(dist.amount), units: 'ft' }
    : dist.type === 'miles' ? { value: String(dist.amount), units: 'mi' } : dist.type === 'unlimited' ? { units: 'any' } : { units: 'spec' };
  const mat = typeof s.components?.m === 'object' ? s.components.m.text : (typeof s.components?.m === 'string' ? s.components.m : '');
  return {
    name: s.name, type: 'spell', img: 'icons/svg/book.svg',
    system: {
      description: { value: entriesToHtml(s.entries) + (s.entriesHigherLevel ? entriesToHtml(s.entriesHigherLevel) : '') },
      source: { book: s.source, page: String(s.page ?? '') },
      level: s.level, school: SCHOOL[s.school] || '', properties: props, materials: { value: mat || '' },
      activation: { type: actType, value: t.number ?? 1 }, duration: dur, range,
      method, prepared, preparation: { mode: method === 'pact' ? 'pact' : prepared === 2 ? 'always' : 'prepared', prepared: prepared > 0 },
    },
  };
}

function featItem(name, entries, kind, from) {
  return { name, type: 'feat', img: 'icons/svg/upgrade.svg', system: { description: { value: entriesToHtml(entries) }, type: { value: kind }, requirements: from || '' } };
}

function gearItem(db, it) {
  const e = it.uid ? db.byUid.item.get(it.uid) : null;
  const ty = String(e?.type || '').split('|')[0];
  const base = { quantity: it.qty || 1, weight: { value: e?.weight ?? 0, units: 'lb' }, price: { value: (e?.value ?? 0) / 100, denomination: 'gp' }, description: { value: entriesToHtml(e?.entries) } };
  if (['LA', 'MA', 'HA', 'S'].includes(ty)) {
    return { name: it.name, type: 'equipment', img: 'icons/svg/shield.svg', system: { ...base, equipped: !!it.equipped, type: { value: { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' }[ty] }, armor: { value: Number(e.ac) || 0, dex: ty === 'MA' ? 2 : ty === 'HA' ? 0 : null }, strength: Number(e.strength) || null } };
  }
  if (ty === 'M' || ty === 'R') {
    const [num, den] = String(e.dmg1 || '1d4').split('d');
    const props = (e.property || []).map(p => WPROP[String(p).split('|')[0]]).filter(Boolean);
    return { name: it.name, type: 'weapon', img: 'icons/svg/sword.svg', system: { ...base, equipped: !!it.equipped,
      type: { value: (e.weaponCategory === 'martial' ? 'martial' : 'simple') + ty }, properties: props,
      damage: { base: { number: Number(num) || 1, denomination: Number(den) || 4, types: [DMG[e.dmgType]].filter(Boolean) }, versatile: e.dmg2 ? { number: Number(e.dmg2.split('d')[0]) || 1, denomination: Number(e.dmg2.split('d')[1]) || 4, types: [DMG[e.dmgType]].filter(Boolean) } : undefined },
      range: e.range ? { value: Number(String(e.range).split('/')[0]) || null, long: Number(String(e.range).split('/')[1]) || null, units: 'ft' } : undefined,
      mastery: e.mastery?.[0] ? lc(String(e.mastery[0]).split('|')[0]) : undefined } };
  }
  if (['AT', 'INS', 'GS', 'T'].includes(ty)) return { name: it.name, type: 'tool', img: 'icons/svg/item-bag.svg', system: { ...base } };
  return { name: it.name, type: 'loot', img: 'icons/svg/item-bag.svg', system: { ...base } };
}

export function buildFoundryActor(db, ch, d) {
  const items = [];
  // classes & subclasses
  for (const info of d.classInfo) {
    const c = info.cls;
    const host = info.subclass?.casterProgression ? info.subclass : c;
    items.push({
      name: c.name, type: 'class', img: 'icons/svg/mystery-man.svg',
      system: {
        identifier: ident(c.name), levels: info.level, hitDice: 'd' + (c.hd?.faces || 8),
        hd: { denomination: 'd' + (c.hd?.faces || 8), spent: 0 },
        spellcasting: c.casterProgression ? { progression: PROG[c.casterProgression] || 'none', ability: c.spellcastingAbility || '' } : { progression: 'none' },
        description: { value: '<p>' + esc(c.name) + ' (' + esc(c.source) + ')</p>' },
      },
    });
    if (info.subclass) {
      const s = info.subclass;
      items.push({ name: s.name, type: 'subclass', img: 'icons/svg/upgrade.svg', system: {
        identifier: ident(s.shortName || s.name), classIdentifier: ident(c.name),
        spellcasting: s.casterProgression ? { progression: PROG[s.casterProgression] || 'none', ability: s.spellcastingAbility || '' } : { progression: 'none' },
        description: { value: '' } } });
    }
    void host;
  }
  if (d.race) items.push({ name: d.race.name, type: 'race', img: 'icons/svg/mystery-man.svg', system: { identifier: ident(d.race.name), description: { value: entriesToHtml(d.race.entries) } } });
  if (d.background) items.push({ name: d.background.name, type: 'background', img: 'icons/svg/book.svg', system: { identifier: ident(d.background.name), description: { value: entriesToHtml(d.background.entries) } } });
  // features
  const kindMap = { race: 'race', background: 'background', class: 'class', subclass: 'class', optional: 'class', feat: 'feat', extra: 'feat' };
  for (const f of d.features) items.push(featItem(f.name, f.entries, kindMap[f.kind] || 'feat', f.from));
  // spells
  const seen = new Set();
  for (const c of d.spellcasting.classes) {
    const method = c.prog === 'pact' ? 'pact' : 'spell';
    for (const s of [...c.cantrips, ...c.spells]) { const k = s.name + s.source; if (seen.has(k)) continue; seen.add(k); items.push(spellItem(s, { method, prepared: 1 })); }
    for (const name of c.always) {
      const s = db.spells.find(x => lc(x.name) === lc(name) && (x.source === 'XPHB' || x.source === 'PHB')) || db.spells.find(x => lc(x.name) === lc(name));
      if (s && !seen.has(s.name + s.source)) { seen.add(s.name + s.source); items.push(spellItem(s, { method, prepared: 2 })); }
    }
  }
  for (const x of ch.extras || []) {
    if (x.type !== 'spell') continue;
    const s = db.byUid.spell.get(x.uid);
    if (s && !seen.has(s.name + s.source)) { seen.add(s.name + s.source); items.push(spellItem(s, { method: 'innate', prepared: 1 })); }
  }
  // inventory
  for (const it of ch.inventory || []) items.push(gearItem(db, it));

  const skills = {};
  for (const [k, v] of Object.entries(d.skills)) if (SKILL_KEYS[k]) skills[SKILL_KEYS[k]] = { value: v.expertise ? 2 : v.prof ? 1 : 0 };
  const abilities = {};
  for (const a of ABILS) abilities[a] = { value: d.scores[a], proficient: d.saves[a].prof ? 1 : 0 };
  const tools = {}; const otherTools = [];
  for (const tname of d.tools) { const k = TOOL_KEYS[lc(tname)]; if (k) tools[k] = { value: 1 }; else otherTools.push(tname); }
  const langs = []; const otherLangs = [];
  for (const l of d.languages) { const k = LANG_KEYS[lc(l)]; if (k) langs.push(k); else otherLangs.push(l); }
  const armorProf = []; const weaponProf = [];
  for (const a of d.armorProf.map(lc)) { if (a.includes('light')) armorProf.push('lgt'); if (a.includes('medium')) armorProf.push('med'); if (a.includes('heavy')) armorProf.push('hvy'); if (a.includes('shield')) armorProf.push('shl'); }
  for (const w of d.weaponProf.map(lc)) { if (w.includes('simple')) weaponProf.push('sim'); if (w.includes('martial')) weaponProf.push('mar'); }
  const hasArmorItem = (ch.inventory || []).some(i => i.equipped && ['LA', 'MA', 'HA'].includes(String(db.byUid.item.get(i.uid)?.type || '').split('|')[0]));
  const isBarb = d.classInfo.some(c => c.cls.name === 'Barbarian'); const isMonk = d.classInfo.some(c => c.cls.name === 'Monk');
  const extraAc = (ch.extras || []).some(x => x.type === 'ac');
  const ac = extraAc ? { calc: 'flat', flat: d.ac } : !hasArmorItem && isBarb ? { calc: 'unarmoredBarb' } : !hasArmorItem && isMonk ? { calc: 'unarmoredMonk' } : { calc: 'default' };
  const bio = [
    ch.notes ? '<p>' + esc(ch.notes).replace(/\n/g, '<br>') + '</p>' : '',
    otherTools.length ? '<p><strong>Tools:</strong> ' + esc(otherTools.join(', ')) + '</p>' : '',
    '<p><em>Exported from Ascandir – CharacterEditor</em></p>',
  ].join('');

  return {
    name: ch.name || 'Unnamed Hero',
    type: 'character',
    img: 'icons/svg/mystery-man.svg',
    system: {
      abilities,
      skills,
      tools,
      attributes: {
        hp: { value: d.hpMax, max: d.hpMax, temp: 0 },
        ac,
        movement: { walk: d.speed, units: 'ft' },
        senses: { darkvision: d.darkvision || 0, units: 'ft' },
      },
      details: { biography: { value: bio, public: '' }, xp: { value: 0 } },
      traits: {
        languages: { value: [...new Set(langs)], custom: otherLangs.join('; ') },
        dr: { value: d.resist.map(lc) },
        armorProf: { value: [...new Set(armorProf)] },
        weaponProf: { value: [...new Set(weaponProf)] },
      },
      currency: { gp: Math.floor(ch.gold || 0), sp: Math.round(((ch.gold || 0) % 1) * 10) },
    },
    items,
    effects: [],
    flags: { 'ascandir-charactereditor': { id: ch.id, version: 1 } },
  };
}
void equipmentGroups;
