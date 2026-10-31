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
  ['tabaxi', 178, () => 'a tabaxi, a feline humanoid with a cat head, fur covered body and a tail'],
  ['aarakocra', 155, () => 'an aarakocra, a bird humanoid with feathers, a beak, wings and talons'],
  ['firbolg', 225, () => 'a firbolg, a large gentle giant-kin with blue-grey skin, a bovine nose and long ears'],
  ['goblin', 105, () => 'a goblin, a small humanoid with green skin, big pointed ears and sharp teeth'],
  ['hobgoblin', 178, () => 'a hobgoblin with orange-red skin and a militaristic bearing'],
  ['bugbear', 205, () => 'a bugbear, a tall hairy goblinoid with long arms'],
  ['kobold', 90, () => 'a kobold, a small reptilian dragon-like humanoid with scales and a tail'],
  ['lizardfolk', 185, () => 'a lizardfolk, a reptilian humanoid with scales, a lizard head and a tail'],
  ['tortle', 180, () => 'a tortle, a turtle humanoid with a large shell'],
  ['triton', 170, () => 'a triton, a sea-dwelling humanoid with blue-green skin and fin-like ears'],
  ['warforged', 185, () => 'a warforged, a living construct made of wood plates and metal'],
  ['changeling', 170, () => 'a changeling with pale grey skin, colorless eyes and white hair'],
  ['kenku', 155, () => 'a kenku, a raven-like bird humanoid with black feathers'],
  ['harengon', 165, () => 'a harengon, a rabbit-folk humanoid with long rabbit ears'],
  ['owlin', 170, () => 'an owlin, an owl humanoid with feathers and large eyes'],
  ['satyr', 170, () => 'a satyr with goat legs and small horns'],
  ['centaur', 210, () => 'a centaur with a human upper body and a horse body'],
  ['minotaur', 210, () => 'a minotaur with a bull head and horns'],
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
export const BODY_PARTS = [
  ['shoulders', 'Schulterbreite', 'Shoulder width', [[20, 'very narrow shoulders'], [38, 'narrow shoulders'], [62, ''], [82, 'broad shoulders'], [100, 'extremely broad shoulders']]],
  ['armLen', 'Armlänge', 'Arm length', [[20, 'very short stubby arms'], [38, 'short arms'], [62, ''], [82, 'long arms'], [100, 'very long lanky arms reaching to the knees']]],
  ['armThick', 'Armdicke', 'Arm thickness', [[20, 'very thin skinny arms'], [38, 'slender arms'], [62, ''], [82, 'thick strong arms'], [100, 'massive heavy arms']]],
  ['bust', 'Oberweite', 'Bust / chest', [[20, { f: 'flat chest', m: 'narrow flat chest' }], [38, { f: 'small bust', m: 'slim chest' }], [62, ''], [82, { f: 'large bust', m: 'broad chest' }], [100, { f: 'very large bust', m: 'very broad barrel chest' }]]],
  ['waist', 'Taille', 'Waist', [[20, 'very narrow waist'], [38, 'slim waist'], [62, ''], [82, 'thick waist'], [100, 'very wide waist']]],
  ['hips', 'Hüfte', 'Hips', [[20, 'very narrow hips'], [38, 'narrow hips'], [62, ''], [82, 'wide hips'], [100, 'very wide hips']]],
  ['butt', 'Po', 'Buttocks', [[20, 'flat buttocks'], [38, 'small buttocks'], [62, ''], [82, 'large rounded buttocks'], [100, 'very large buttocks']]],
  ['legLen', 'Beinlänge', 'Leg length', [[20, 'very short stubby legs'], [38, 'short legs'], [62, ''], [82, 'long legs'], [100, 'very long legs']]],
  ['legThick', 'Beindicke', 'Leg thickness', [[20, 'very thin spindly legs'], [38, 'slender legs'], [62, ''], [82, 'thick strong legs'], [100, 'massive heavy legs']]],
  ['head', 'Kopfgröße', 'Head size', [[20, 'very small head'], [38, 'small head'], [62, ''], [82, 'large head'], [100, 'very large head']]],
];

export const MULTI_VIEW = 'character turnaround reference sheet, four full body views of the exact same character side by side in one row, from left to right: front view, side view facing right, back view, side view facing left, each view from head to feet, standing in a relaxed A-pose with arms slightly away from the body, orthographic camera at chest height, even neutral lighting, identical outfit, colors and proportions in every view';
export const MULTI_SIZE = { width: 1792, height: 1024, views: 4 };

export function buildPrompt(d, ch, p, opts = {}) {
  const sp = speciesOf(d?.race?.name || 'Human');
  const fr = FRAMINGS.find(f => f[0] === p.framing) || FRAMINGS[0];
  const st = STYLES.find(s => s[0] === p.style) || STYLES[0];
  const parts = [];
  const g = p.gender === 'female' ? 'woman' : p.gender === 'nonbinary' ? 'androgynous person' : 'man';
  const age = pick(p.age, [[25, 'young adult'], [40, 'adult'], [55, 'middle-aged'], [70, 'older, with grey streaks and wrinkles'], [100, 'elderly, white hair and deep wrinkles']]);
  // framing first: the model weighs the beginning of the prompt most
  const pose = (p.pose || '').trim();
  parts.push(opts.multi ? MULTI_VIEW : pose ? fr[2].replace('standing pose', '').replace(/,\s*,/g, ',') + ', pose: ' + pose : fr[2]);
  parts.push(`${age} ${g}, ${sp.text}`);
  parts.push(pick(p.attract, LOOKS));
  parts.push(pick(p.build, [[12, 'very thin, gaunt build'], [32, 'slim build'], [58, 'average build'], [74, 'stocky, slightly heavy build'], [89, 'heavyset, overweight with a round belly'], [100, 'very fat, obese body']]));
  const curvy = pick(p.curvy, [[18, 'straight angular figure'], [48, ''], [74, 'curvy figure'], [100, 'very curvy hourglass figure']]);
  if (curvy) parts.push(curvy);
  const mus = pick(p.muscle, [[18, 'frail with little muscle'], [52, ''], [78, 'muscular, athletic'], [100, 'extremely muscular, powerful physique']]);
  if (mus) parts.push(mus);
  for (const [k, , , scale] of BODY_PARTS) {
    const v = p.body?.[k]; if (v == null || v === 50) continue;
    let txt = pick(v, scale); if (txt && typeof txt === 'object') txt = p.gender === 'male' ? txt.m : txt.f;
    if (txt) parts.push(txt);
  }
  const h = p.height || sp.avg;
  const rel = (h - sp.avg) / sp.avg;
  parts.push(pick(rel, [[-0.15, `very short for their kind (${h} cm)`], [-0.06, `short for their kind (${h} cm)`], [0.06, `average height (${h} cm)`], [0.15, `tall for their kind (${h} cm)`], [9, `very tall for their kind (${h} cm)`]]));
  if (p.hair) parts.push(p.hair + ' hair');
  if (p.skin) parts.push(p.skin + ' skin');
  if (p.eyes) parts.push(p.eyes + ' eyes');
  if (p.features) parts.push(p.features);
  // clothing & gear
  const gear = [];
  if (p.useGear && d) {
    const cls = d.classInfo?.[0]?.cls?.name;
    if (cls && CLASS_GEAR[lc(cls)]) gear.push(CLASS_GEAR[lc(cls)]);
    const eq = (ch?.inventory || []).filter(i => i.equipped).map(i => i.name);
    if (eq.length) gear.push('equipped with ' + eq.join(', '));
  }
  if (p.clothing) gear.push(p.clothing);
  if (gear.length) parts.push('wearing ' + gear.join(', '));
  parts.push('fully clothed, safe for work');
  if (p.extra) parts.push(p.extra);
  parts.push(opts.multi ? 'plain flat light grey background, no scenery, no text, no labels, no frames between the views' : p.removeBg ? 'plain simple studio background, no scenery, no text' : 'atmospheric fantasy background, no text');
  parts.push(st[0] === 'custom' ? (p.customStyle || '').trim() || STYLES[0][2] : st[2]);
  return parts.filter(Boolean).join(', ');
}

export function frameSize(p) {
  const fr = FRAMINGS.find(f => f[0] === p.framing) || FRAMINGS[0];
  return { width: fr[3], height: fr[4] };
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
