// Builds the image prompt from the character sheet + painter sliders.
// Always adult, always clothed (safe for work).
import { lc } from '../data/loader.js';

// typical height (cm) and look per species; matched by name prefix
const SPECIES = [
  ['dragonborn', 190, (c) => `a dragonborn, a tall humanoid dragon person with ${c || 'metallic'} scales, a reptilian dragon head with a snout and small horns, clawed hands, no tail, no wings`],
  ['tiefling', 170, () => 'a tiefling, a human-like fiendish person with large curved horns, a long thin tail and solid-colored eyes'],
  ['half-elf', 172, () => 'a half-elf with slightly pointed ears'],
  ['half-orc', 182, () => 'a half-orc with grey-green skin, a strong jaw and small tusks'],
  ['elf', 170, () => 'an elf with long pointed ears'],
  ['eladrin', 170, () => 'an eladrin fey elf with long pointed ears and seasonal colored hair'],
  ['drow', 165, () => 'a drow, a dark elf with obsidian dark skin, white hair and pointed ears'],
  ['dwarf', 135, () => 'a dwarf, short, stocky and broad-shouldered'],
  ['duergar', 130, () => 'a duergar, a grey-skinned bald deep dwarf, short and stocky'],
  ['halfling', 95, () => 'a halfling, a small adult person about three feet tall with adult facial features'],
  ['gnome', 100, () => 'a gnome, a small person about three and a half feet tall with a large nose'],
  ['goliath', 225, () => 'a goliath, a towering giant-kin with grey stone-like skin and dark tribal markings'],
  ['orc', 188, () => 'an orc with green-grey skin and prominent tusks'],
  ['aasimar', 172, () => 'an aasimar with a celestial aura, faintly glowing eyes and luminous skin'],
  ['tabaxi', 178, () => 'a tabaxi, an anthropomorphic cat folk, NOT a human: a full feline cat head with a muzzle and whiskers, the entire body covered in patterned fur, a long cat tail, clawed paw-like hands'],
  ['aarakocra', 155, () => 'an aarakocra, an anthropomorphic eagle-like birdfolk, NOT a human: a full eagle head with a hooked beak and bird eyes, the entire body covered in feathers with no human skin anywhere, two huge feathered bird wings growing from the back, scaly yellow bird legs with digitigrade knees and large clawed talons instead of feet'],
  ['firbolg', 225, () => 'a firbolg, a large gentle giant-kin with blue-grey skin, a bovine nose and long ears'],
  ['goblin', 105, () => 'a goblin, a small humanoid with green skin, big pointed ears and sharp teeth'],
  ['hobgoblin', 178, () => 'a hobgoblin with orange-red skin and a militaristic bearing'],
  ['bugbear', 205, () => 'a bugbear, a tall hairy goblinoid with long arms'],
  ['kobold', 90, () => 'a kobold, a small dragon-like reptile humanoid, NOT a human: a small dragon head with a snout and tiny horns, the body covered in scales, a long tail, clawed hands'],
  ['lizardfolk', 185, () => 'a lizardfolk, an anthropomorphic reptile, NOT a human: a full lizard head with a long snout, the entire body covered in scales, a thick long tail, clawed hands and feet'],
  ['tortle', 180, () => 'a tortle, an anthropomorphic turtle, NOT a human: a turtle head with a beak-like mouth, scaly leathery skin, a large domed turtle shell on the back and a plastron on the chest'],
  ['triton', 170, () => 'a triton, a sea-dwelling humanoid with blue-green skin and fin-like ears'],
  ['warforged', 185, () => 'a warforged, a living construct made of wood plates and metal'],
  ['changeling', 170, () => 'a changeling with pale grey skin, colorless eyes and white hair'],
  ['kenku', 155, () => 'a kenku, an anthropomorphic raven birdfolk, NOT a human: a full raven head with a black beak, the entire body covered in black feathers with no human skin, scaly bird legs with clawed talons, no wings'],
  ['harengon', 165, () => 'a harengon, an anthropomorphic rabbit folk: a rabbit head with long upright ears and a twitching nose, the body covered in soft fur, large rabbit feet'],
  ['owlin', 170, () => 'an owlin, an anthropomorphic owl folk, NOT a human: a full owl head with large round eyes and a small beak, the entire body covered in owl feathers, feathered wings on the back, bird talons'],
  ['satyr', 170, () => 'a satyr with goat legs and small horns'],
  ['centaur', 210, () => 'a centaur with a human upper body and a horse body'],
  ['minotaur', 210, () => 'a minotaur, NOT a human: a full bull head with a broad muzzle and large curved horns on a huge muscular body covered in short fur, hooves'],
  ['genasi', 172, (c) => `a ${c ? c.toLowerCase() + ' ' : ''}genasi, an elemental-touched humanoid`],
  ['yuan-ti', 172, () => 'a yuan-ti, a snake-blooded humanoid with scaly patches and serpent eyes'],
  ['human', 172, () => 'a human'],
];

const CLASS_GEAR = {
  artificer: 'leather apron, goggles and tinkering gadgets',
  barbarian: 'fur and hide clothing, tribal ornaments',
  bard: 'colorful fine traveling clothes with a musical instrument',
  cleric: 'religious vestments over chainmail with a holy symbol',
  druid: 'natural robes adorned with leaves and bone, wooden staff',
  fighter: 'practical battle-worn armor',
  monk: 'simple martial-arts robes and wraps',
  paladin: 'polished plate armor with a tabard and a holy emblem',
  ranger: 'hooded cloak, leather armor and a quiver of arrows',
  rogue: 'dark leather armor, hood and belts with daggers',
  sorcerer: 'elegant robes with arcane markings',
  warlock: 'dark mysterious clothing with eldritch symbols',
  wizard: 'scholarly robes, a spellbook and a staff',
};

export const STYLES = [
  ['painted', { de: 'Gemalt', en: 'Painted' }, 'detailed fantasy digital painting, character concept art, painterly brushwork, dramatic lighting, highly detailed'],
  ['realistic', { de: 'Realistisch', en: 'Realistic' }, 'photorealistic cinematic fantasy character, realistic skin and materials, highly detailed'],
  ['game', { de: '3D-Spiel', en: '3D game' }, 'high-quality 3D render of a fantasy role-playing video game character, PBR materials, soft studio lighting'],
  ['comic', { de: 'Comic', en: 'Comic' }, 'comic book illustration, bold ink outlines, flat vibrant colors'],
  ['ink', { de: 'Tusche', en: 'Ink' }, 'pen and ink drawing, cross-hatching, sepia tones, old fantasy book illustration'],
  ['watercolor', { de: 'Aquarell', en: 'Watercolor' }, 'watercolor painting, soft washes, delicate lines'],
  ['anime', { de: 'Anime', en: 'Anime' }, 'anime style illustration, cel shading, clean lines'],
  ['custom', { de: 'Eigener Stil', en: 'Custom style' }, ''],
];

export const FRAMINGS = [
  ['full', { de: 'Ganzkörper', en: 'Full body' }, 'full body shot, the entire figure is visible from head to feet, standing pose, centered', 832, 1216],
  ['three', { de: 'Dreiviertel', en: 'Three-quarter' }, 'three-quarter shot from head to knees, centered', 896, 1152],
  ['portrait', { de: 'Portrait', en: 'Portrait' }, 'head and shoulders portrait, looking at the viewer, centered', 1024, 1024],
];

export const DEFAULT_PAINTER = {
  gender: 'male', height: null, build: 40, curvy: 30, muscle: 50, attract: 55, age: 35,
  hair: '', skin: '', eyes: '', features: '', clothing: '', useGear: true, extra: '',
  style: 'painted', framing: 'full', removeBg: true, strength: 45, promptOverride: null,
  crop: { size: 42, x: 50, y: 16 },
};

function speciesOf(raceName) {
  const n = lc(raceName || 'human');
  const color = /\(([^)]+)\)/.exec(raceName || '')?.[1];
  for (const [key, h, desc] of SPECIES) if (n.startsWith(key)) return { avg: h, text: desc(color), key };
  for (const [key, h, desc] of SPECIES) if (n.includes(key)) return { avg: h, text: desc(color), key };
  return { avg: 170, text: `a ${raceName} (fantasy humanoid)`, key: n };
}

export function typicalHeight(raceName) { return speciesOf(raceName).avg; }

// [adult from, typical maximum age] in years (D&D lore, rounded)
const AGES = {
  human: [18, 90], 'half-elf': [20, 180], elf: [100, 750], eladrin: [100, 750], drow: [100, 750], dwarf: [50, 350], duergar: [50, 350],
  halfling: [20, 150], gnome: [40, 425], dragonborn: [15, 80], 'half-orc': [14, 75], orc: [12, 80], tiefling: [18, 100], aasimar: [18, 160],
  goliath: [18, 100], firbolg: [30, 500], tabaxi: [18, 100], aarakocra: [3, 30], kenku: [12, 60], tortle: [15, 50], lizardfolk: [14, 80],
  goblin: [8, 60], hobgoblin: [18, 100], bugbear: [16, 80], kobold: [6, 120], triton: [15, 200], warforged: [2, 150], changeling: [18, 100],
  harengon: [18, 100], owlin: [18, 100], satyr: [18, 120], centaur: [15, 100], minotaur: [17, 150], genasi: [18, 120], 'yuan-ti': [18, 100],
};
export function speciesAge(raceName) {
  const k = speciesOf(raceName).key;
  const [adult, max] = AGES[k] || AGES.human;
  return { adult, max };
}
export function isMinorAge(raceName, age) { return (age ?? 30) < speciesAge(raceName).adult; }

const pick = (v, table) => { for (const [max, txt] of table) if (v <= max) return txt; return table[table.length - 1][1]; };

// Looks: the model tends to make everyone pretty, so the low end has to be very explicit.
const LOOKS = [
  [6, 'grotesquely ugly and hideous creature-like face, emaciated and gaunt, sunken cheeks, bulging watery eyes, crooked rotten teeth, sparse stringy hair, warts and blotchy sickly skin, hunched posture, repulsive'],
  [15, 'very ugly face, misshapen crooked nose, uneven bulging eyes, bad teeth, pockmarked blotchy skin, warts, greasy unkempt hair, unpleasant appearance'],
  [28, 'ugly face, coarse irregular features, big crooked nose, small uneven eyes, rough scarred skin, unkempt'],
  [40, 'unattractive plain homely face, asymmetrical features, tired eyes, rough skin'],
  [58, 'ordinary average-looking face, unremarkable features'],
  [72, 'good-looking face, pleasant features'],
  [86, 'very attractive face, charismatic, striking features'],
  [100, 'stunningly beautiful face, captivating gaze, perfect features'],
];

// body detail sliders (50 = no mention). [key, de, en, [[max, text]...]]
// body detail sliders (50 = no mention). Six steps: extreme low, strong, mild | mild, strong, extreme high.
// Extremes are deliberately exaggerated (stylised, cartoonish proportions are fine).
const S = (xl, l, ml, mh, h, xh) => [[8, xl], [25, l], [42, ml], [58, ''], [75, mh], [92, h], [100, xh]];
// key, de, en, scale. Extremes are deliberately absurd (stylised fantasy caricature), the user wants a huge range.
export const BODY_PARTS = [
  ['head', 'Kopfgröße', 'Head size', S('tiny pin head, absurdly small head on the body', 'very small head', 'small head', 'large head', 'very large head', 'huge oversized cartoon head, head twice the normal size')],
  ['shoulders', 'Schulterbreite', 'Shoulder width', S('extremely narrow sloping shoulders, shoulders barely wider than the head', 'very narrow shoulders', 'narrow shoulders', 'broad shoulders', 'very broad massive shoulders', 'absurdly wide shoulders, shoulders twice as wide as normal, enormous V-shaped torso')],
  ['armLen', 'Armlänge', 'Arm length', S('tiny stubby arms that end at the waist', 'very short stubby arms', 'short arms', 'long arms', 'very long lanky arms reaching to the knees', 'absurdly long ape-like arms with the hands hanging below the knees')],
  ['armThick', 'Oberarme', 'Upper arms', S('stick-thin skeletal upper arms like twigs', 'very thin upper arms', 'slender upper arms', 'thick upper arms', 'very thick massive upper arms, huge biceps', 'gigantic upper arms thicker than the head, absurdly bulging biceps')],
  ['forearm', 'Unterarme', 'Forearms', S('stick-thin skeletal forearms', 'very thin forearms', 'slender forearms', 'thick forearms', 'very thick massive forearms', 'gigantic Popeye-like forearms, absurdly huge forearms')],
  ['bust', 'Oberweite', 'Bust / chest', S({ f: 'completely flat chest, no bust at all', m: 'sunken narrow flat chest' }, { f: 'very small bust, flat-chested', m: 'very narrow thin chest' }, { f: 'small bust', m: 'slim chest' }, { f: 'large bust', m: 'broad chest' }, { f: 'very large heavy oversized bust', m: 'very broad barrel chest' }, { f: 'comically gigantic oversized bust, each side bigger than her head, absurd impractical cartoon caricature proportions, fully covered by her outfit', m: 'absurdly enormous barrel chest, gigantic torso' })],
  ['waist', 'Taille', 'Waist', S('impossibly tiny wasp waist', 'very narrow waist', 'slim waist', 'thick waist', 'very wide thick waist', 'enormous round waist, barrel-shaped torso')],
  ['belly', 'Bauch', 'Belly', S('extremely flat sunken stomach, visible ribs', 'very flat toned stomach', 'flat stomach', 'soft round belly', 'big round protruding belly', 'gigantic hugely protruding round belly, absurdly huge gut')],
  ['hips', 'Hüfte', 'Hips', S('completely straight narrow hips, no hips at all', 'very narrow hips', 'narrow hips', 'wide hips', 'very wide hips', 'absurdly wide hips, hips twice as wide as the waist')],
  ['butt', 'Po', 'Buttocks', S('completely flat buttocks, flat as a board', 'very flat small buttocks', 'small buttocks', 'large rounded buttocks', 'very large round buttocks', 'absurdly gigantic protruding buttocks, cartoonish exaggerated proportions')],
  ['legLen', 'Beinlänge', 'Leg length', S('tiny stubby legs, extremely short legs', 'very short legs', 'short legs', 'long legs', 'very long legs', 'absurdly long legs that make up most of the body height')],
  ['legThick', 'Oberschenkel', 'Thighs', S('stick-thin skeletal thighs with a big gap', 'very thin thighs', 'slender thighs', 'thick thighs', 'very thick heavy thighs', 'gigantic tree-trunk thighs, absurdly massive thighs')],
  ['calf', 'Waden', 'Calves', S('stick-thin bony calves', 'very thin calves', 'slender calves', 'muscular calves', 'very thick heavy calves', 'gigantic bulging calves, absurdly massive lower legs')],
];
const EXTREME = (v) => v != null && (v <= 15 || v >= 85);

export function bodyText(p, keys, only) {
  const out = []; let extreme = false;
  for (const [k, , , scale] of BODY_PARTS) {
    if (keys && !keys.includes(k)) continue;
    const v = p.body?.[k]; if (v == null || (v > 42 && v < 58)) continue;
    if (only === 'extreme' && !EXTREME(v)) continue;
    if (only === 'normal' && EXTREME(v)) continue;
    let txt = pick(v, scale); if (txt && typeof txt === 'object') txt = p.gender === 'male' ? txt.m : txt.f;
    if (txt) out.push(txt);
    if (v <= 25 || v >= 75) extreme = true;
  }
  if (extreme && only !== 'normal') out.push('exaggerated stylised caricature body proportions');
  return out;
}

export const MULTI_VIEW = 'character turnaround reference sheet, four full body views of the exact same character side by side in one row, from left to right: front view, side view facing right, back view, side view facing left, each view from head to feet, standing in a relaxed A-pose with arms slightly away from the body, orthographic camera at chest height, even neutral lighting, identical outfit, colors and proportions in every view';
export const MULTI_SIZE = { width: 1792, height: 1024, views: 4 };

export const SFW_COVER = 'the chest, torso, arms and legs are completely covered by the outfit, no bare skin on the body, no cleavage, no bikini or revealing armor';
const DE_EN = [
  ['dunkelrot', 'dark red'], ['hellrot', 'light red'], ['tiefrot', 'deep red'], ['blutrot', 'blood red'], ['karmesinrot', 'crimson'], ['karmesin', 'crimson'], ['rot', 'red'],
  ['dunkelblau', 'dark blue'], ['hellblau', 'light blue'], ['blau', 'blue'], ['dunkelgrün', 'dark green'], ['hellgrün', 'light green'], ['grün', 'green'],
  ['schwarz', 'black'], ['weiß', 'white'], ['weiss', 'white'], ['grau', 'grey'], ['silbern', 'silver'], ['silber', 'silver'], ['golden', 'golden'], ['gold', 'gold'],
  ['lila', 'purple'], ['violett', 'violet'], ['gelb', 'yellow'], ['orange', 'orange'], ['braun', 'brown'], ['rosa', 'pink'], ['türkis', 'turquoise'], ['bronze', 'bronze'], ['kupfer', 'copper'],
  ['blond', 'blonde'], ['brünett', 'brunette'], ['blass', 'pale'], ['gebräunt', 'tanned'], ['dunkel', 'dark'], ['hell', 'light'], ['schuppen', 'scales'], ['schuppig', 'scaly'],
  ['lang', 'long'], ['kurz', 'short'], ['lockig', 'curly'], ['glatt', 'straight'], ['geflochten', 'braided'], ['zopf', 'braid'], ['glatze', 'bald head'], ['bart', 'beard'],
  ['pferdeschwanz', 'ponytail'], ['zopf', 'braid'], ['zöpfe', 'braids'], ['dutt', 'bun'], ['haarknoten', 'hair bun'], ['irokese', 'mohawk'], ['undercut', 'undercut'],
  ['locken', 'curls'], ['gelockt', 'curly'], ['gewellt', 'wavy'], ['wellig', 'wavy'], ['schulterlang', 'shoulder-length'], ['hüftlang', 'waist-length'], ['kinnlang', 'chin-length'],
  ['kurzgeschoren', 'buzz cut'], ['rasiert', 'shaved'], ['seitenscheitel', 'side part'], ['mittelscheitel', 'middle part'], ['pony', 'bangs'], ['zurückgekämmt', 'slicked back'],
  ['hochgesteckt', 'updo'], ['offen', 'loose'], ['zerzaust', 'messy'], ['strähnig', 'stringy'], ['strähnen', 'streaks'], ['dreadlocks', 'dreadlocks'], ['rastas', 'dreadlocks'],
  ['seiten', 'sides'], ['auf einer seite', 'on one side'], ['hinten', 'at the back'], ['vorne', 'at the front'], ['voll', 'full'], ['dicht', 'thick'], ['dünn', 'thin'],
  ['hörner', 'horns'], ['schwanz', 'tail'], ['flügel', 'wings'], ['krallen', 'claws'], ['federn', 'feathers'], ['fell', 'fur'], ['ohren', 'ears'], ['spitze', 'pointed'],
  ['rüstung', 'armor'], ['mantel', 'cloak'], ['umhang', 'cape'], ['kapuze', 'hood'], ['robe', 'robe'], ['leder', 'leather'], ['kettenhemd', 'chainmail'], ['plattenrüstung', 'plate armor'],
  ['narbe', 'scar'], ['narben', 'scars'], ['tätowierung', 'tattoo'], ['tattoos', 'tattoos'], ['augen', 'eyes'], ['auge', 'eye'], ['haar', 'hair'], ['haut', 'skin'], ['und', 'and'], ['mit', 'with'],
];
function toEn(text, tr) {
  if (tr && text && tr[String(text).trim()]) return tr[String(text).trim()];
  let t = String(text || '');
  // German adjectives are inflected (rote, langes, ...): accept the usual endings
  for (const [de, en] of DE_EN) t = t.replace(new RegExp('(^|[^\\p{L}])' + de + '(?:e|en|er|es|em)?(?=$|[^\\p{L}])', 'giu'), (m, pre) => pre + en);
  return t.trim();
}

export function buildPrompt(d, ch, p, opts = {}) {
  const sp = speciesOf(d?.race?.name || 'Human');
  const fr = FRAMINGS.find(f => f[0] === p.framing) || FRAMINGS[0];
  const st = STYLES.find(s => s[0] === p.style) || STYLES[0];
  const parts = [];
  const g = p.gender === 'female' ? 'woman' : p.gender === 'nonbinary' ? 'androgynous person' : 'man';
  const sa = speciesAge(d?.race?.name || 'Human');
  const years = p.age ?? 30;
  const minor = years < sa.adult;
  // age relative to the species: an elf with 300 is a young adult, a human with 300 is ancient
  const f = (years - sa.adult) / Math.max(1, sa.max - sa.adult);
  const age = minor
    ? (years < sa.adult * 0.55 ? 'young child (' + years + ' years old) with childlike proportions,' : 'teenager (' + years + ' years old) with youthful proportions,')
    : pick(f, [[0.12, 'young adult'], [0.35, 'adult'], [0.55, 'middle-aged'], [0.75, 'older, with grey streaks and wrinkles'], [1, 'elderly, white hair and deep wrinkles'], [9e9, 'ancient, extremely old, deeply wrinkled']]);
  const styleText = st[0] === 'custom' ? (p.customStyle || '').trim() || STYLES[0][2] : st[2];
  // the style goes first (Z-Image weighs the beginning most, otherwise the style only reaches the face) and again at the end
  if (!opts.multi) parts.push(styleText);
  const pose = toEn(p.pose, p.tr);
  parts.push(opts.multi ? MULTI_VIEW : pose ? fr[2].replace('standing pose', '').replace(/,\s*,/g, ',') + ', pose: ' + pose : fr[2]);
  if (opts.emphasis?.length && !minor) parts.push('IMPORTANT, clearly visible body shape: ' + opts.emphasis.join(', '));
  const skin = toEn(p.skin, p.tr);
  const who = minor ? (p.gender === 'female' ? 'girl' : p.gender === 'nonbinary' ? 'child' : 'boy') : g;
  parts.push(`${age} ${who}, ${sp.text}${skin ? `, with ${skin} skin color on the whole body` : ''}`);
  // children / teens: no body shaping or attractiveness wording at all
  if (minor) p = { ...p, body: {}, curvy: 40, attract: Math.min(p.attract ?? 50, 58), sfwLock: true };
  const ext = bodyText(p, null, 'extreme');
  if (ext.length) parts.push('IMPORTANT exaggerated body proportions: ' + ext.join(', '));
  // clothing early and explicit: otherwise the model often leaves the upper body bare
  const gear = [];
  if (p.useGear && d) {
    const cls = d.classInfo?.[0]?.cls?.name;
    if (cls && CLASS_GEAR[lc(cls)]) gear.push(CLASS_GEAR[lc(cls)]);
    const eq = (ch?.inventory || []).filter(i => i.equipped).map(i => i.name);
    if (eq.length) gear.push('equipped with ' + eq.join(', '));
  }
  if (p.clothing) gear.push(toEn(p.clothing, p.tr));
  const sfw = p.sfwLock !== false;
  parts.push((gear.length ? 'wearing ' + gear.join(', ') : 'wearing practical fantasy adventurer clothing') + (sfw ? ', ' + SFW_COVER : ''));
  parts.push(pick(p.attract, LOOKS));
  parts.push(...bodyText(p, null, 'normal'));
  parts.push(pick(p.build, [[12, 'very thin, gaunt build'], [32, 'slim build'], [58, 'average build'], [74, 'stocky, slightly heavy build'], [89, 'heavyset, overweight with a round belly'], [100, 'very fat, obese body']]));
  const curvy = pick(p.curvy, [[18, 'straight angular figure'], [48, ''], [74, 'curvy figure'], [100, 'very curvy hourglass figure']]);
  if (curvy) parts.push(curvy);
  const mus = pick(p.muscle, [[18, 'frail with little muscle'], [52, ''], [78, 'muscular, athletic'], [100, 'extremely muscular, powerful physique']]);
  if (mus) parts.push(mus);
  const h = p.height || sp.avg;
  const rel = (h - sp.avg) / sp.avg;
  parts.push(pick(rel, [[-0.15, `very short for their kind (${h} cm)`], [-0.06, `short for their kind (${h} cm)`], [0.06, `average height (${h} cm)`], [0.15, `tall for their kind (${h} cm)`], [9, `very tall for their kind (${h} cm)`]]));
  if (p.hair) { const h2 = toEn(p.hair, p.tr); parts.push(/hair|bald/i.test(h2) ? h2 : h2 + ' hair'); }
  if (p.eyes) { const e2 = toEn(p.eyes, p.tr); parts.push(/eye/i.test(e2) ? e2 : e2 + ' eyes'); }
  if (p.features) parts.push(toEn(p.features, p.tr));
  parts.push(sfw ? 'fully clothed, modest outfit, safe for work' : 'safe for work');
  if (p.extra) parts.push(toEn(p.extra, p.tr));
  parts.push(opts.multi ? 'plain flat light grey background, no scenery, no text, no labels, no frames between the views' : p.removeBg ? 'plain flat uniform light grey studio background, no shadow on the floor, no scenery, no text' : 'atmospheric fantasy background, no text');
  parts.push(styleText);
  return parts.filter(Boolean).join(', ');
}

// output resolution presets (megapixel factor relative to the framing's base size ~1 MP)
export const RESOLUTIONS = [
  ['fast', { de: 'Schnell', en: 'Fast' }, 0.6],
  ['std', { de: 'Standard', en: 'Standard' }, 1],
  ['high', { de: 'Hoch', en: 'High' }, 1.5],
  ['max', { de: 'Sehr hoch', en: 'Very high' }, 2.1],
  // painted at "standard", then enlarged with the Real-ESRGAN upscaler to the given long side
  ['2k', { de: '2K', en: '2K' }, 1, 2560],
  ['4k', { de: '4K', en: '4K' }, 1, 3840],
];
export function upscaleSize(p) {
  const r = RESOLUTIONS.find(x => x[0] === p.res); if (!r?.[3]) return null;
  const { width, height } = frameSize(p); const k = r[3] / Math.max(width, height);
  return { width: Math.round(width * k / 8) * 8, height: Math.round(height * k / 8) * 8 };
}
export function frameSize(p) {
  const fr = FRAMINGS.find(f => f[0] === p.framing) || FRAMINGS[0];
  const r = RESOLUTIONS.find(x => x[0] === p.res) || RESOLUTIONS[1];
  const k = Math.sqrt(r[2]);
  return { width: Math.round(fr[3] * k / 64) * 64, height: Math.round(fr[4] * k / 64) * 64 };
}

// Fallback background removal (when the BiRefNet model is not installed):
// region growing from the borders that follows smooth gradients/vignettes.
export async function removeBackground(dataUrl, localTol = 9, globalTol = 170) {
  const img = new Image(); img.src = dataUrl; await img.decode();
  const w = img.naturalWidth; const h = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const id = ctx.getImageData(0, 0, w, h); const px = id.data;
  const dist = (a, b) => { const dr = px[a * 4] - px[b * 4]; const dg = px[a * 4 + 1] - px[b * 4 + 1]; const db = px[a * 4 + 2] - px[b * 4 + 2]; return Math.sqrt(dr * dr + dg * dg + db * db); };
  const sat = (i) => { const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2]; return Math.max(r, g, b) - Math.min(r, g, b); };
  const bg = new Uint8Array(w * h); const seed = new Int32Array(w * h).fill(-1);
  const stack = [];
  const push = (i, from) => { bg[i] = 1; seed[i] = from; stack.push(i); };
  for (let x = 0; x < w; x++) { for (const i of [x, x + (h - 1) * w]) if (!bg[i] && sat(i) < 40) push(i, i); }
  for (let y = 0; y < h; y++) { for (const i of [y * w, y * w + w - 1]) if (!bg[i] && sat(i) < 40) push(i, i); }
  while (stack.length) {
    const i = stack.pop(); const x = i % w; const y = (i / w) | 0;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of nb) if (j >= 0 && !bg[j] && dist(i, j) < localTol && dist(seed[i], j) < globalTol && sat(j) < 45) push(j, seed[i]);
  }
  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { px[i * 4 + 3] = 0; continue; }
    const x = i % w; const y = (i / w) | 0;
    let n = 0;
    if (x > 0 && bg[i - 1]) n++; if (x < w - 1 && bg[i + 1]) n++; if (y > 0 && bg[i - w]) n++; if (y < h - 1 && bg[i + w]) n++;
    if (n) px[i * 4 + 3] = 255 - n * 50;
  }
  ctx.putImageData(id, 0, 0);
  return c.toDataURL('image/png');
}

// prompt written by the user / the AI advisor ("free" mode in the painter)
export { toEn };
export function freePrompt(p, opts = {}) {
  const st = STYLES.find(s => s[0] === p.style) || STYLES[0];
  const parts = [];
  if (opts.multi) parts.push(MULTI_VIEW);
  parts.push((p.freePrompt || '').trim());
  if (opts.emphasis?.length) parts.push('IMPORTANT, clearly visible body shape: ' + opts.emphasis.join(', '));
  if (opts.multi) parts.push('plain flat light grey background, no scenery, no text, no labels');
  else if (p.removeBg && p.freeBg !== false) parts.push('plain flat uniform light grey studio background, no shadow on the floor, no scenery, no text');
  if (p.sfwLock !== false) parts.push('fully clothed, ' + SFW_COVER + ', safe for work');
  if (p.freeAppendStyle) parts.push(st[0] === 'custom' ? (p.customStyle || '').trim() : st[2]);
  return parts.filter(Boolean).join(', ');
}
