import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';

const LOCAL = process.env.ACE_DATA || '/home/claude/5edata/';
globalThis.window = { ace: { async fetchData(url) {
  const p = url.replace('https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/', LOCAL);
  return { text: fs.readFileSync(p, 'utf8') };
} } };
const { loadOfficial, buildDb, uidOf } = await import('../src/data/loader.js');
const R = await import('../src/engine/rules.js');

const official = await loadOfficial();
const db = buildDb(official);
const S24 = { rules: '2024', disabledSources: [] };
const S14 = { rules: '2014', disabledSources: [] };
const find = (list, name, src) => list.find(e => e.name === name && e.source === src);

test('db basics', () => {
  assert.ok(db.races.length > 100);
  assert.ok(db.classes.length >= 13);
  assert.ok(db.spells.length > 500);
});

test('2024 filter hides PHB Dragonborn, shows XPHB', () => {
  const f = R.makeFilter(db, S24);
  assert.equal(f(find(db.races, 'Dragonborn', 'PHB')), false);
  assert.equal(f(find(db.races, 'Dragonborn', 'XPHB')), true);
  const g = R.makeFilter(db, S14);
  assert.equal(g(find(db.races, 'Dragonborn', 'XPHB')), false);
  assert.equal(g(find(db.races, 'Dragonborn', 'PHB')), true);
});

test('2024 dragonborn paladin 5', () => {
  const ch = { base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }, raceUid: 'dragonborn|xphb', backgroundUid: 'soldier|xphb',
    levels: Array.from({ length: 5 }, () => ({ classUid: 'paladin|xphb' })), choices: {}, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  const ids = d.choices.map(c => c.id);
  console.log('choices', ids.join(', '));
  assert.ok(ids.includes('race:version'));
  const ver = d.choices.find(c => c.id === 'race:version');
  console.log('versions', ver.options.map(o => o.label).join(','));
  ch.choices['race:version'] = [ver.options.find(o => o.label.includes('Bronze')).value];
  ch.choices['bg:abil'] = { mode: 0, abil: ['str', 'con'] };
  d = R.derive(db, S24, ch);
  assert.ok(d.race.name.includes('Bronze'));
  assert.ok(d.resist.includes('lightning'));
  assert.equal(d.scores.str, 17); assert.equal(d.scores.con, 15);
  assert.ok(d.skills.athletics.prof);
  const sub = d.choices.find(c => c.id === 'sub:paladin|xphb');
  assert.ok(sub && sub.options.length > 3, 'subclass options');
  console.log('subclasses', sub.options.map(o => o.label).join(', '));
  ch.choices[sub.id] = [sub.options.find(o => /Devotion/.test(o.label)).value];
  d = R.derive(db, S24, ch);
  console.log('features', d.features.map(f => f.name).join(' | '));
  assert.ok(d.features.some(f => f.name === 'Extra Attack'));
  assert.ok(d.choices.some(c => c.kind === 'asiFeat'));
  assert.ok(d.choices.some(c => c.id.includes(':fp:Fighting Style')));
  const sp = d.choices.filter(c => c.spell);
  console.log('spell choices', sp.map(c => c.id + ' x' + c.count + ' opts ' + c.options.length).join('; '));
  assert.ok(sp.length > 0);
  console.log('slots', JSON.stringify(d.spellcasting.slots), 'hp', d.hpMax, 'ac', d.ac, 'open', d.open.length);
  assert.deepEqual(d.spellcasting.slots, [4, 2]);
  assert.equal(d.hpMax, 10 + 4 * 6 + 2 * 5);
});

test('2014 elf wizard + multiclass', () => {
  const ch = { base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, raceUid: 'elf|phb', backgroundUid: 'sage|phb',
    levels: [{ classUid: 'wizard|phb' }, { classUid: 'wizard|phb' }, { classUid: 'fighter|phb' }], choices: {}, extras: [], inventory: [] };
  let d = R.derive(db, S14, ch);
  const sr = d.choices.find(c => c.id === 'race:subrace');
  console.log('elf subraces', sr.options.map(o => o.label).join(', '));
  ch.choices['race:subrace'] = [sr.options.find(o => o.label === 'High').value];
  d = R.derive(db, S14, ch);
  assert.equal(d.scores.dex, 16); assert.equal(d.scores.int, 16);
  const ids = d.choices.map(c => c.id);
  console.log(ids.join(', '));
  assert.ok(ids.some(i => i.includes(':of:Fighting Style')));
  assert.ok(ids.includes('lvl0:cantrips:wizard|phb'));
  const book = d.choices.find(c => c.id === 'lvl0:spells:wizard|phb');
  assert.equal(book.count, 6);
  console.log('slots', JSON.stringify(d.spellcasting.slots), 'hp', d.hpMax);
  assert.deepEqual(d.spellcasting.slots, [3]);
});

test('warlock 2014 invocations + pact', () => {
  const ch = { base: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 }, raceUid: 'tiefling|phb', backgroundUid: 'acolyte|phb',
    levels: Array.from({ length: 3 }, () => ({ classUid: 'warlock|phb' })), choices: {}, extras: [], inventory: [] };
  const d = R.derive(db, S14, ch);
  console.log(d.choices.map(c => c.id + '(' + (c.count || '') + ')').join(', '));
  assert.deepEqual(d.spellcasting.pact, { count: 2, level: 2 });
});

test('equipment groups', () => {
  const p = db.byUid.class.get('paladin|xphb');
  const g = R.equipmentGroups(db, p);
  console.log(JSON.stringify(g).slice(0, 300));
  assert.ok(g.length);
});

test('chosen invocations disappear from later picks, prereqs readable', () => {
  const ch = { base: { str: 8, dex: 14, con: 13, int: 10, wis: 12, cha: 15 }, raceUid: 'human|xphb', backgroundUid: 'sage|xphb',
    levels: Array.from({ length: 5 }, () => ({ classUid: 'warlock|xphb' })), choices: {}, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  const ei = d.choices.filter(c => c.id.includes(':of:Eldritch Invocations'));
  console.log(ei.map(c => c.id + ' x' + c.count + ' opts ' + c.options.length).join('; '));
  const first = ei[0];
  const ag = first.options.find(o => o.label === 'Agonizing Blast');
  console.log('prereq', ag.prereq, '| unmet', ag.unmet);
  ch.choices[first.id] = [first.options.find(o => o.label === 'Armor of Shadows').value];
  d = R.derive(db, S24, ch);
  const later = d.choices.filter(c => c.id.includes(':of:Eldritch Invocations') && c.id !== first.id);
  for (const c of later) assert.ok(!c.options.some(o => o.label === 'Armor of Shadows'));
  assert.equal(new Set(first.options.map(o => o.label)).size, first.options.length, 'no duplicates');
  const lvl1 = d.choices.find(c => c.id === first.id);
  assert.ok(lvl1.options.some(o => o.label === 'Armor of Shadows'));
});

test('tool choices are picks from official tools', () => {
  const ch = { base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, raceUid: 'human|xphb', backgroundUid: 'soldier|xphb',
    levels: [{ classUid: 'artificer|efa' }], choices: { 'background:tool:0': 'Dice set' }, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  const tools = d.choices.filter(c => c.id.includes(':tool:'));
  console.log(tools.map(c => c.id + ' ' + c.label + ' [' + c.options.map(o => o.label).slice(0, 4).join(', ') + '…] value=' + JSON.stringify(c.value)).join('\n'));
  assert.ok(tools.every(c => c.kind === 'pick' && c.options.length > 1));
  const gs = tools.find(c => c.id === 'background:tool:0');
  ch.choices[gs.id] = ['Dice Set'];
  d = R.derive(db, S24, ch);
  assert.ok(d.tools.includes('Dice Set'));
});

test('foundry export', async () => {
  const { buildFoundryActor } = await import('../src/export/foundry.js');
  const ch = { name: 'Kael', base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }, raceUid: 'dragonborn|xphb', backgroundUid: 'soldier|xphb',
    levels: Array.from({ length: 5 }, () => ({ classUid: 'paladin|xphb' })), choices: {}, extras: [], gold: 12.5,
    inventory: [{ uid: 'chain mail|xphb', name: 'Chain Mail', qty: 1, equipped: true }, { uid: 'longsword|xphb', name: 'Longsword', qty: 1, equipped: true }, { uid: 'shield|xphb', name: 'Shield', qty: 1, equipped: true }] };
  let d = R.derive(db, S24, ch);
  ch.choices['race:version'] = [d.choices.find(c => c.id === 'race:version').options.find(o => o.label === 'Bronze').value];
  const sub = R.derive(db, S24, ch).choices.find(c => c.id === 'sub:paladin|xphb');
  ch.choices[sub.id] = [sub.options.find(o => /Devotion/.test(o.label)).value];
  const sp = R.derive(db, S24, ch).choices.find(c => c.id === 'lvl0:spells:paladin|xphb');
  ch.choices[sp.id] = sp.options.slice(0, 2).map(o => o.value);
  ch.choices['background:tool:0'] = ['Dice Set'];
  d = R.derive(db, S24, ch);
  const a = buildFoundryActor(db, ch, d);
  const types = a.items.reduce((m, i) => (m[i.type] = (m[i.type] || 0) + 1, m), {});
  console.log('types', JSON.stringify(types), 'hp', a.system.attributes.hp.max, 'tools', JSON.stringify(a.system.tools), 'dr', a.system.traits.dr.value);
  console.log(JSON.stringify(a.items.find(i => i.type === 'spell')).slice(0, 400));
  console.log(JSON.stringify(a.items.find(i => i.type === 'weapon').system).slice(0, 300));
  assert.equal(a.type, 'character');
  assert.ok(types.class === 1 && types.subclass === 1 && types.spell >= 2 && types.weapon === 1 && types.equipment === 2);
});

test('weapon mastery + 2014 ranger choices', () => {
  const mk = (cls, n) => ({ base: { str: 10, dex: 15, con: 14, int: 8, wis: 13, cha: 10 }, raceUid: 'human|xphb', backgroundUid: 'soldier|xphb',
    levels: Array.from({ length: n }, () => ({ classUid: cls })), choices: {}, extras: [], inventory: [] });
  let ch = mk('ranger|xphb', 1);
  let d = R.derive(db, S24, ch);
  const wm = d.choices.find(c => /:wm$/.test(c.id));
  assert.ok(wm, 'ranger has weapon mastery');
  assert.equal(wm.count, 2);
  assert.ok(wm.options.some(o => o.label === 'Longbow'));
  ch.choices[wm.id] = [wm.options[0].value, wm.options[1].value];
  d = R.derive(db, S24, ch);
  assert.ok(d.features.some(f => /^Weapon Mastery: /.test(f.name) && f.entries?.length));
  const fighter = R.derive(db, S24, mk('fighter|xphb', 4));
  const fw = fighter.choices.filter(c => /:wm$/.test(c.id)).map(c => c.count);
  assert.deepEqual(fw, [3, 1]);
  const barb = R.derive(db, S24, mk('barbarian|xphb', 1)).choices.find(c => /:wm$/.test(c.id));
  assert.ok(!barb.options.some(o => o.label === 'Longbow'), 'barbarian: melee only');
  const r14 = R.derive(db, S14, { ...mk('ranger|phb', 1), raceUid: 'human|phb', backgroundUid: 'soldier|phb' });
  assert.ok(r14.choices.some(c => /:fe$/.test(c.id)) && r14.choices.some(c => /:ne$/.test(c.id)));
});

test('skills from species/background are not offered again for the class', () => {
  const ch = { base: { str: 10, dex: 15, con: 14, int: 8, wis: 13, cha: 10 }, raceUid: 'elf|xphb', backgroundUid: 'soldier|xphb',
    levels: [{ classUid: 'ranger|xphb' }], choices: {}, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  ch.choices['race:version'] = [d.choices.find(c => c.id === 'race:version').options[0].value];
  d = R.derive(db, S24, ch);
  const rc = d.choices.find(c => c.kind === 'skill' && c.group === 'race');
  assert.ok(rc, 'elf skill choice');
  ch.choices[rc.id] = ['survival'];
  d = R.derive(db, S24, ch);
  const cc = d.choices.find(c => c.kind === 'skill' && c.group === 'class');
  const vals = cc.options.map(o => o.value);
  assert.ok(!vals.includes('survival'), 'survival hidden');
  assert.ok(!vals.includes('athletics'), 'background athletics hidden');
  assert.ok(cc.already.includes('survival'));
});

test('spells from background feat (Magic Initiate) are known and not offered again', () => {
  const ch = { base: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, raceUid: 'human|xphb', backgroundUid: 'sage|xphb',
    levels: [{ classUid: 'wizard|xphb' }], choices: {}, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  const cantr = d.choices.find(c => c.bonusSpell && c.options.every(o => o.spellLevel === 0));
  assert.ok(cantr, 'magic initiate cantrip choice: ' + d.choices.map(c => c.id).join(','));
  const fb = cantr.options.find(o => o.label === 'Fire Bolt');
  ch.choices[cantr.id] = [fb.value, cantr.options.find(o => o.label !== 'Fire Bolt').value];
  d = R.derive(db, S24, ch);
  assert.ok(d.spellcasting.bonus.some(b => b.s.name === 'Fire Bolt'));
  const wc = d.choices.find(c => /:cantrips:/.test(c.id));
  assert.ok(!wc.options.some(o => o.label === 'Fire Bolt'), 'fire bolt hidden for wizard cantrips');
  assert.ok(wc.alreadySpells.includes('Fire Bolt'));
  // tiefling legacy: fixed cantrip known
  const t = R.derive(db, S24, { ...ch, raceUid: 'tiefling|xphb', choices: {} });
  const ver = t.choices.find(c => c.id === 'race:version');
  if (ver) { const t2 = R.derive(db, S24, { ...ch, raceUid: 'tiefling|xphb', choices: { 'race:version': [ver.options[0].value] } }); assert.ok(t2.spellcasting.bonus.length > 0, 'tiefling spells'); }
  else assert.ok(t.choices.some(c => c.id === 'race:spellset'));
});

test('2024 wizard: spellbook 6+2+2, evoker savant, subclass features listed', () => {
  const ch = { base: { int: 16 }, raceUid: 'human|xphb', backgroundUid: 'soldier|xphb', levels: [1, 2, 3].map(() => ({ classUid: 'wizard|xphb' })), choices: { 'sub:wizard|xphb': ['evoker|wizard|xphb|xphb'] }, extras: [], inventory: [] };
  let d = R.derive(db, S24, ch);
  const sub = d.choices.find(c => c.id === 'sub:wizard|xphb');
  ch.choices[sub.id] = [sub.options.find(o => o.label === 'Evoker').value];
  d = R.derive(db, S24, ch);
  const counts = d.choices.filter(c => /:spells:/.test(c.id)).map(c => c.count);
  assert.deepEqual(counts, [6, 2, 2]);
  const sav = d.choices.find(c => /:savant:/.test(c.id));
  assert.equal(sav.count, 2);
  assert.ok(sav.options.every(o => o.entity.school === 'V' && o.spellLevel <= 2));
  assert.ok(d.features.some(f => f.name === 'Potent Cantrip'));
  assert.deepEqual(d.spellcasting.slots, [4, 2]);
  assert.equal(d.spellcasting.bonus.length, 0, 'no background spells for a soldier');
});

test('background feat from a category (Mist Wanderer → Dark Gift)', () => {
  const ch = { base: {}, raceUid: 'human|xphb', backgroundUid: 'mist wanderer|rhw', levels: [{ classUid: 'fighter|xphb' }], choices: {}, extras: [], inventory: [] };
  const d = R.derive(db, S24, ch);
  const c = d.choices.find(x => x.id.startsWith('bg:feat:'));
  assert.ok(c, 'dark gift choice');
  assert.equal(c.label, 'Dark Gift');
  assert.ok(c.options.some(o => o.label === 'Mist Walker'));
  assert.ok(c.options.every(o => o.entity.category === 'DG'));
});

test('feat sub-choices are asked where the feat comes from', () => {
  const base = { base: {}, raceUid: 'human|phb', levels: [{ classUid: 'fighter|phb' }], choices: {}, extras: [], inventory: [] };
  // Astral Drifter grants Magic Initiate (PHB): spell list + spells in the background step
  let d = R.derive(db, S14, { ...base, backgroundUid: 'astral drifter|aag' });
  const set = d.choices.find(c => /:spellset$/.test(c.id));
  assert.ok(set && set.group === 'background', 'spell list choice in background step');
  const ch = { ...base, backgroundUid: 'astral drifter|aag', choices: { ...base.choices, [set.id]: [String(set.options.findIndex(o => /Cleric/.test(o.label)))] } };
  d = R.derive(db, S14, ch);
  const can = d.choices.find(c => c.bonusSpell && c.group === 'background' && c.options.every(o => o.spellLevel === 0));
  assert.ok(can && can.options.some(o => o.label === 'Sacred Flame'));
  // Skilled via the 2014 variant human feat: 3 skills/tools
  const sr = R.derive(db, S14, { ...base, backgroundUid: 'soldier|phb' }).choices.find(c => c.id === 'race:subrace');
  base.choices = { 'race:subrace': [sr.options.find(o => /variant/i.test(o.label)).value] };
  const vh = R.derive(db, S14, { ...base, backgroundUid: 'soldier|phb' });
  const featPick = vh.choices.find(c => c.id.startsWith('race:feat:'));
  assert.ok(featPick, 'variant human feat choice');
  const sk = R.derive(db, S14, { ...base, backgroundUid: 'soldier|phb', choices: { ...base.choices, [featPick.id]: [featPick.options.find(o => o.label === 'Skilled' && o.src === 'PHB').value] } });
  const stl = sk.choices.find(c => c.id.startsWith('featstl:'));
  assert.ok(stl && stl.count === 3 && stl.group === 'race');
  const rs = R.derive(db, S14, { ...base, backgroundUid: 'soldier|phb', choices: { ...base.choices, [featPick.id]: [featPick.options.find(o => o.label === 'Resilient' && o.src === 'PHB').value] } });
  const ab = rs.choices.find(c => c.id.startsWith('featabil:'));
  assert.ok(ab && ab.group === 'race');
  const rs2 = R.derive(db, S14, { ...base, backgroundUid: 'soldier|phb', choices: { ...base.choices, [featPick.id]: [featPick.options.find(o => o.label === 'Resilient' && o.src === 'PHB').value], [ab.id]: ['wis'] } });
  assert.ok(rs2.saves.wis.prof, 'resilient wis save');
});

test('ASI feat sub-choices belong to their level', () => {
  const ch = { base: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }, raceUid: 'human|xphb', backgroundUid: 'soldier|xphb',
    levels: Array.from({ length: 4 }, () => ({ classUid: 'fighter|xphb' })), choices: { 'lvl3:asi': { mode: 'feat', feat: 'athlete|xphb' } }, extras: [], inventory: [] };
  const d = R.derive(db, S24, ch);
  assert.ok(d.choices.some(c => c.levelIndex === 3 && c.id.startsWith('featabil:lvl3:asi')));
  assert.ok(!d.choices.find(c => c.id === 'lvl3:asi').featOptions.some(o => o.label === 'Ability Score Improvement'));
});
