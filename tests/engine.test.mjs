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
