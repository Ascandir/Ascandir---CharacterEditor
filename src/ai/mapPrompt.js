// Battle maps for Foundry VTT: options, prompt and scene export.
import { toEn } from './prompt.js';

const L = (de, en) => ({ de, en });

export const MAP_CAMERAS = [
  ['top', L('Draufsicht', 'Top-down'), 'strict 90 degree overhead view, the camera looks straight down, orthographic top-down projection like a floor plan or satellite image, flat 2D map', L('Beste Wahl für Foundry: passt genau aufs Raster', 'Best for Foundry: fits the grid exactly')],
  ['oblique', L('Leicht schräg', 'Slightly oblique'), 'seen from high above with a slight three-quarter tilt, buildings and trees show a little of their sides', L('Mehr Tiefe, Raster passt etwas schlechter', 'More depth, grid fits a little worse')],
  ['iso', L('Isometrisch', 'Isometric'), 'isometric view at a 30 degree angle, like a classic isometric role-playing game', L('Schön zum Zeigen, nicht für das quadratische Raster', 'Nice to show, not for the square grid')],
  ['3d', L('3D-Render von oben', '3D render from above'), 'strict 90 degree overhead view of a detailed 3D rendered diorama, the camera looks straight down, orthographic, soft ambient occlusion and short cast shadows', L('Draufsicht mit plastischer 3D-Optik', 'Top-down with a sculpted 3D look')],
];

// how much depth the map may show: pure 2D is what fits Foundry's grid best
export const MAP_DEPTH = [
  ['flat', L('Reines 2D', 'Pure 2D'), 'pure flat 2D illustration with no depth and no height: like a printed paper map or a blueprint, flat shading, no cast shadows, no ambient occlusion, nothing sticks up out of the ground, walls are flat dark bands drawn on the ground plan', L('Ganz flach wie eine gedruckte Karte, ohne Schatten und Höhe', 'Completely flat like a printed map, no shadows or height')],
  ['soft', L('2D mit leichten Schatten', '2D with soft shadows'), 'flat 2D illustration seen straight from above with only very short soft drop shadows, no visible side faces of anything', L('Flach, aber mit dezenten Schatten für etwas Plastizität', 'Flat, with subtle shadows for a bit of shape')],
  ['deep', L('Plastisch (2,5D)', 'Sculpted (2.5D)'), 'top-down view with depth: soft shadows and some height', L('Mehr Tiefe, Wände wirken erhöht', 'More depth, walls look raised')],
];

export const MAP_BIOMES = [
  ['forest', L('Wald', 'Forest'), 'a temperate forest'],
  ['deepforest', L('Dichter Urwald', 'Old forest'), 'an ancient overgrown forest with huge old trees and moss'],
  ['jungle', L('Dschungel', 'Jungle'), 'a dense tropical jungle with lush vegetation'],
  ['grassland', L('Wiese / Grasland', 'Grassland'), 'open grassland and meadows'],
  ['hills', L('Hügel', 'Hills'), 'rolling hills with patches of grass and rock'],
  ['mountain', L('Gebirge', 'Mountains'), 'a rocky mountain pass with cliffs and scree'],
  ['desert', L('Wüste', 'Desert'), 'a sandy desert with dunes and dry rocks'],
  ['badlands', L('Steppe / Ödland', 'Badlands'), 'dry cracked badlands with sparse shrubs'],
  ['snow', L('Schnee / Tundra', 'Snow / tundra'), 'a snowy frozen tundra with ice and snow drifts'],
  ['swamp', L('Sumpf', 'Swamp'), 'a murky swamp with muddy water, reeds and dead trees'],
  ['coast', L('Küste / Strand', 'Coast / beach'), 'a coastline with a sandy beach, rocks and shallow sea water'],
  ['river', L('Flusstal', 'River valley'), 'a green river valley'],
  ['volcano', L('Vulkan', 'Volcanic'), 'volcanic black rock terrain with glowing lava cracks'],
  ['cave', L('Höhle', 'Cave'), 'a natural underground cave with rough rock walls and stone floor'],
  ['underdark', L('Unterreich', 'Underdark'), 'the Underdark, a vast underground cavern with glowing fungi and crystals'],
  ['dungeon', L('Dungeon', 'Dungeon'), 'a stone dungeon with carved stone walls and flagstone floors'],
  ['city', L('Stadt', 'City'), 'a medieval fantasy city district with cobblestone streets'],
  ['village', L('Dorf', 'Village'), 'a rural fantasy village'],
  ['feywild', L('Feenwild', 'Feywild'), 'a magical Feywild glade with vivid colors, giant flowers and glowing motes'],
  ['shadow', L('Schattenreich', 'Shadowfell'), 'the gloomy Shadowfell with grey withered land and dead trees'],
  ['astral', L('Elementar / Astral', 'Elemental / astral'), 'a surreal elemental plane with floating rocks'],
];

export const MAP_SITES = [
  ['none', L('Nur Landschaft', 'Just terrain'), ''],
  ['road', L('Straße / Weg', 'Road'), 'a road crossing the area'],
  ['camp', L('Lager', 'Camp'), 'a camp site in the middle'],
  ['clearing', L('Lichtung', 'Clearing'), 'a clearing in the middle'],
  ['ruins', L('Ruinenstätte', 'Ruins'), 'the overgrown ruins of an old structure'],
  ['crossroads', L('Kreuzung', 'Crossroads'), 'a crossroads of two paths'],
  ['bridge', L('Brücke / Übergang', 'Bridge crossing'), 'a bridge over a river or chasm'],
  ['village', L('Dorfplatz', 'Village square'), 'a village square surrounded by houses'],
  ['market', L('Marktplatz', 'Market'), 'a busy market square with stalls (empty of people)'],
  ['tavern_out', L('Taverne (außen)', 'Tavern (outside)'), 'a tavern building with a yard'],
  ['tavern_in', L('Taverne (innen)', 'Tavern (inside)'), 'the interior of a tavern seen from above with the roof removed, tables, chairs, bar counter and fireplace'],
  ['house_in', L('Haus (innen)', 'House (inside)'), 'the interior of a house seen from above with the roof removed, rooms with furniture'],
  ['temple', L('Tempel / Schrein', 'Temple / shrine'), 'a temple or shrine'],
  ['castle', L('Burg / Festung', 'Castle / fort'), 'a castle courtyard with walls and towers'],
  ['dungeon_room', L('Dungeon-Raum', 'Dungeon room'), 'a dungeon chamber with corridors leading out, seen from above with the ceiling removed'],
  ['crypt', L('Gruft', 'Crypt'), 'a crypt with sarcophagi, seen from above with the ceiling removed'],
  ['mine', L('Mine', 'Mine'), 'a mine with tunnels, rails and wooden supports'],
  ['ship', L('Schiffsdeck', 'Ship deck'), 'the deck of a sailing ship on the water'],
  ['docks', L('Hafen / Steg', 'Docks'), 'harbor docks with wooden piers'],
  ['arena', L('Arena', 'Arena'), 'a fighting arena'],
  ['lair', L('Monsterhort', 'Monster lair'), 'a monster lair with bones and treasure'],
];

export const MAP_LIGHT = [
  ['neutral', L('Neutral (für Foundry-Licht)', 'Neutral (for Foundry lighting)'), 'even neutral daylight, soft diffuse lighting, no strong shadows, no colored light', 0],
  ['bright', L('Voll beleuchtet', 'Bright daylight'), 'bright sunny daylight, crisp clear shadows', 0],
  ['dusk', L('Dämmerung', 'Dusk'), 'warm golden hour dusk light, long soft shadows', 0.25],
  ['night', L('Nacht', 'Night'), 'night time, dark moonlit scene with blue tones', 0.7],
  ['torch', L('Fackel- / Feuerschein', 'Torch- / firelight'), 'dark scene lit only by warm torches, lanterns and fires', 0.6],
  ['dark', L('Dunkel', 'Dark'), 'very dark scene with deep shadows and only faint light', 0.85],
];

export const MAP_WEATHER = [
  ['clear', L('Klar', 'Clear'), ''],
  ['rain', L('Regen', 'Rain'), 'rainy weather, wet surfaces and puddles'],
  ['fog', L('Nebel', 'Fog'), 'light ground fog in patches'],
  ['snow', L('Schneefall', 'Snowfall'), 'falling snow and a thin snow cover'],
  ['storm', L('Sturm', 'Storm'), 'stormy weather, wind-swept, broken branches'],
];

export const MAP_SEASONS = [
  ['any', L('egal', 'any'), ''],
  ['spring', L('Frühling', 'Spring'), 'spring, fresh green and blossoms'],
  ['summer', L('Sommer', 'Summer'), 'summer, lush and green'],
  ['autumn', L('Herbst', 'Autumn'), 'autumn, orange and red foliage, fallen leaves'],
  ['winter', L('Winter', 'Winter'), 'winter, bare trees and frost'],
];

export const MAP_STYLES = [
  ['fa', L('Wie Dungeondraft / Forgotten Adventures', 'Like Dungeondraft / Forgotten Adventures'), 'detailed virtual tabletop battle map in the style of Forgotten Adventures and Dungeondraft: hand-drawn semi-realistic textures with thin dark outlines, wooden floorboards, stone floor tiles, grass and dirt ground textures, every object drawn as a flat top-down cut-out with a subtle soft drop shadow, interiors shown with the roof removed and walls as thin bands seen from above'],
  ['painted', L('Handgemalt (klassisch)', 'Hand-painted (classic)'), 'hand-painted digital fantasy battle map, rich textures, detailed, professional virtual tabletop map art'],
  ['clean', L('Klar & sauber', 'Clean digital'), 'clean crisp digital battle map with clear readable shapes, strong outlines and flat textures'],
  ['realistic', L('Realistisch', 'Realistic'), 'photorealistic top-down terrain, realistic textures and materials'],
  ['ink', L('Tusche / Pergament', 'Ink / parchment'), 'old parchment map drawn in ink and watercolor washes'],
  ['watercolor', L('Aquarell', 'Watercolor'), 'soft watercolor battle map with gentle washes'],
  ['dark', L('Düster / Grimdark', 'Grim dark'), 'gritty grimdark painted battle map, desaturated colors'],
  ['custom', L('Eigener Stil', 'Custom style'), ''],
];

// assets: [key, label, prompt noun, group]
export const MAP_ASSETS = [
  ['trees', L('Bäume', 'Trees'), 'trees', 'nature'], ['bushes', L('Büsche', 'Bushes'), 'bushes and shrubs', 'nature'],
  ['rocks', L('Felsen', 'Rocks'), 'rocks and boulders', 'nature'], ['cliffs', L('Klippen / Abhänge', 'Cliffs'), 'cliffs and rocky ledges', 'nature'],
  ['flowers', L('Blumen / hohes Gras', 'Flowers / tall grass'), 'patches of flowers and tall grass', 'nature'], ['mushrooms', L('Pilze', 'Mushrooms'), 'mushrooms', 'nature'],
  ['crystals', L('Kristalle', 'Crystals'), 'glowing crystals', 'nature'], ['logs', L('Umgestürzte Bäume', 'Fallen logs'), 'fallen logs and stumps', 'nature'],
  ['river', L('Fluss', 'River'), 'a river', 'water'], ['stream', L('Bach', 'Stream'), 'a small stream', 'water'],
  ['pond', L('See / Teich', 'Pond / lake'), 'a pond', 'water'], ['waterfall', L('Wasserfall', 'Waterfall'), 'a waterfall', 'water'],
  ['puddles', L('Pfützen / Schlamm', 'Puddles / mud'), 'puddles and mud', 'water'], ['lava', L('Lava', 'Lava'), 'lava flows', 'water'],
  ['road', L('Straße', 'Road'), 'a dirt road', 'paths'], ['path', L('Trampelpfad', 'Footpath'), 'a narrow footpath', 'paths'],
  ['plaza', L('Gepflasterter Platz', 'Paved plaza'), 'a cobblestone plaza', 'paths'], ['stairs', L('Treppen', 'Stairs'), 'stone stairs', 'paths'],
  ['ruins', L('Ruinen', 'Ruins'), 'crumbling stone ruins', 'build'], ['tents', L('Zelte', 'Tents'), 'tents', 'build'],
  ['campfire', L('Lagerfeuer', 'Campfire'), 'campfires', 'build'], ['tavern', L('Taverne', 'Tavern'), 'a tavern building', 'build'],
  ['houses', L('Häuser / Gebäude', 'Houses'), 'houses', 'build'], ['tower', L('Turm', 'Tower'), 'a stone tower', 'build'],
  ['walls', L('Mauern / Palisade', 'Walls / palisade'), 'walls and a wooden palisade', 'build'], ['bridge', L('Brücke', 'Bridge'), 'a bridge', 'build'],
  ['well', L('Brunnen', 'Well'), 'a well', 'build'], ['shrine', L('Schrein / Altar', 'Shrine / altar'), 'a shrine with an altar', 'build'],
  ['statues', L('Statuen', 'Statues'), 'statues', 'build'], ['graves', L('Gräber', 'Graves'), 'gravestones', 'build'],
  ['stalls', L('Marktstände', 'Market stalls'), 'market stalls', 'build'], ['cave', L('Höhleneingang', 'Cave entrance'), 'a cave entrance', 'build'],
  ['pier', L('Steg', 'Pier'), 'a wooden pier', 'build'], ['fences', L('Zäune', 'Fences'), 'wooden fences', 'build'],
  ['crates', L('Kisten & Fässer', 'Crates & barrels'), 'crates and barrels', 'props'], ['carts', L('Karren / Wagen', 'Carts / wagons'), 'carts and wagons', 'props'],
  ['tables', L('Tische & Bänke', 'Tables & benches'), 'tables and benches', 'props'], ['hay', L('Heuballen', 'Hay bales'), 'hay bales', 'props'],
  ['weapons', L('Waffenständer', 'Weapon racks'), 'weapon racks', 'props'], ['bones', L('Knochen', 'Bones'), 'scattered bones and skulls', 'props'],
  ['treasure', L('Schatz', 'Treasure'), 'a treasure pile with gold coins and chests', 'props'], ['traps', L('Fallen', 'Traps'), 'hidden pressure plates and spike traps', 'props'],
];
export const ASSET_GROUPS = [['nature', L('Natur', 'Nature')], ['water', L('Wasser', 'Water')], ['paths', L('Wege', 'Paths')], ['build', L('Bauten', 'Structures')], ['props', L('Kleinkram', 'Props')]];
export const AMOUNTS = [[1, L('einzeln', 'single'), 'a single'], [2, L('wenige', 'few'), 'a few'], [3, L('einige', 'some'), 'several'], [4, L('viele', 'many'), 'many'], [5, L('sehr viele', 'lots'), 'lots of']];

export const MAP_SIZES = [[20, 15, L('Klein 20×15', 'Small 20×15')], [30, 20, L('Mittel 30×20', 'Medium 30×20')], [40, 30, L('Groß 40×30', 'Large 40×30')], [25, 25, L('Quadrat 25×25', 'Square 25×25')], [20, 40, L('Hochkant 20×40', 'Tall 20×40')]];

export const DEFAULT_MAP = {
  camera: 'top', depth: 'flat', biome: 'forest', site: 'clearing', light: 'neutral', weather: 'clear', season: 'any', style: 'fa', customStyle: '',
  assets: { trees: 4, rocks: 3, path: 2 }, density: 50, cols: 30, rows: 20, gridPx: 100, noCreatures: true, extra: '',
  promptMode: 'sliders', freePrompt: '', strictTop: true, model: 'zimage', qSteps: 30, strength: 55, editText: '', bakeGrid: false, gridAlpha: 25, folder: 'battlemaps',
};

const amountWord = (n) => (AMOUNTS.find(a => a[0] === n) || AMOUNTS[2])[2];

export function mapPrompt(m, tr = {}) {
  if (m.promptMode === 'free') return (m.freePrompt || '').trim() + (m.noCreatures ? ', no people, no creatures, no characters' : '') + ', no grid lines, no text';
  const cam = MAP_CAMERAS.find(x => x[0] === m.camera) || MAP_CAMERAS[0];
  const biome = MAP_BIOMES.find(x => x[0] === m.biome) || MAP_BIOMES[0];
  const site = MAP_SITES.find(x => x[0] === m.site);
  const light = MAP_LIGHT.find(x => x[0] === m.light) || MAP_LIGHT[0];
  const weather = MAP_WEATHER.find(x => x[0] === m.weather);
  const season = MAP_SEASONS.find(x => x[0] === m.season);
  const st = MAP_STYLES.find(x => x[0] === m.style) || MAP_STYLES[0];
  const style = st[0] === 'custom' ? (toEn(m.customStyle, tr) || MAP_STYLES[0][2]) : st[2];
  const parts = [];
  const flat = ['top', '3d'].includes(cam[0]);
  const depth = cam[0] === 'top' ? (MAP_DEPTH.find(x => x[0] === m.depth) || MAP_DEPTH[0]) : null;
  // the camera goes first: the models weigh the beginning most and otherwise drift to a tilted game view
  parts.push(cam[2] + ', a tabletop role-playing battle map for a virtual tabletop');
  if (depth) parts.push(depth[2]);
  parts.push(style);
  parts.push('showing ' + biome[2] + (site?.[2] ? ' with ' + site[2] : ''));
  const assets = MAP_ASSETS.filter(([k]) => m.assets?.[k]).map(([k, , noun]) => {
    const n = m.assets[k];
    // single features ("a river"): the amount sets their size; groups ("trees"): how many
    if (/^a /.test(noun)) { const x = noun.replace(/^a /, ''); return n <= 2 ? 'a small ' + x : n >= 4 ? 'a large prominent ' + x : 'a ' + x; }
    return (n === 1 ? 'one or two' : amountWord(n)) + ' ' + noun;
  });
  if (assets.length) parts.push('the map contains ' + assets.join(', '));
  const dens = m.density ?? 50;
  parts.push(dens < 25 ? 'sparse and open, lots of free walkable space' : dens < 60 ? 'balanced layout with open walkable areas between the features' : dens < 85 ? 'busy and detailed with many small features' : 'extremely cluttered and dense');
  if (season?.[2]) parts.push(season[2]);
  if (weather?.[2]) parts.push(weather[2]);
  parts.push(depth?.[0] === 'flat' ? light[2].replace(/,?\s*(crisp clear|long soft|deep) shadows/g, '') + ', flat even light without cast shadows' : light[2]);
  if (m.extra) parts.push(toEn(m.extra, tr));
  parts.push(m.camera === 'iso' ? 'the scene fills the whole image' : 'a cropped section of a larger area, the terrain continues past all four image edges, no decorative border, no frame around the map, no vignette, no sky, no horizon');
  if (flat) parts.push('everything is seen from straight above as on an architect\'s floor plan: walls are drawn only as their flat top surface, pillars, statues and rocks only as their tops, trees as round canopies, buildings as roofs or floor plans, stairs as flat rows of steps, all lines of the architecture run parallel to the image edges');
  if (m.noCreatures) parts.push('empty of people and creatures, ready for game tokens');
  parts.push('no grid lines, no text, no labels, no compass, no user interface');
  parts.push(flat ? (depth?.[0] === 'flat' ? 'pure flat 2D, ' : '') + 'top-down 90 degree overhead orthographic view, ' + style : style);
  return parts.filter(Boolean).join(', ');
}

// generation size: about 1.1 megapixel in the map's aspect ratio; final size = squares × grid px (via upscaler, max 8192)
// for Qwen Image 2.1 with CFG: what a top-down map must not look like
export const MAP_NEGATIVE = 'isometric view, perspective, three-quarter view, tilted camera, side view, angled view, vanishing point, visible side walls, horizon, sky, decorative border, frame, text, grid lines, people, creatures';
export const MAP_NEGATIVE_FLAT = MAP_NEGATIVE + ', 2.5D, 3D render, depth, height, raised walls, extruded walls, cast shadows, ambient occlusion, bevel';

// SDXL battle map LoRA: short tag-like prompt that starts with its trigger words
export const SDXL_MAP_NEGATIVE = 'blurry, grainy, 3d render, isometric, perspective, tilted, grid, watermark, text, signature, people, person, creature, frame, border';
export function mapPromptSdxl(m, tr = {}) {
  if (m.promptMode === 'free') return 'dnd battle map, top down view, 2d, ' + (m.freePrompt || '').trim();
  const biome = MAP_BIOMES.find(x => x[0] === m.biome) || MAP_BIOMES[0];
  const site = MAP_SITES.find(x => x[0] === m.site);
  const light = MAP_LIGHT.find(x => x[0] === m.light) || MAP_LIGHT[0];
  const weather = MAP_WEATHER.find(x => x[0] === m.weather);
  const season = MAP_SEASONS.find(x => x[0] === m.season);
  const st = MAP_STYLES.find(x => x[0] === m.style) || MAP_STYLES[0];
  const styleShort = { fa: 'hand-drawn semi-realistic textures, thin dark outlines', painted: 'hand-painted, detailed textures', clean: 'clean vector art, flat colors', realistic: 'photorealistic textures', ink: 'ink drawing on parchment', watercolor: 'watercolor', dark: 'grimdark, desaturated' }[st[0]] || toEn(m.customStyle, tr);
  const assets = MAP_ASSETS.filter(([k]) => m.assets?.[k]).map(([k, , noun]) => { const n = m.assets[k]; return /^a /.test(noun) ? (n >= 4 ? 'large ' : n <= 2 ? 'small ' : '') + noun.replace(/^a /, '') : (n >= 4 ? 'many ' : n <= 1 ? 'few ' : '') + noun; });
  const lightShort = { neutral: 'even daylight', bright: 'bright daylight', dusk: 'dusk', night: 'night, moonlight', torch: 'night, torchlight', dark: 'dark' }[light[0]];
  return ['dnd battle map, top down view, 2d', biome[2].replace(/^an? /, ''), site?.[2] ? site[2].replace(/^an? /, '') : '', ...assets, season?.[2] || '', weather?.[2] || '', lightShort, m.extra ? toEn(m.extra, tr) : '', styleShort, m.noCreatures ? 'no humans' : '', 'highly detailed']
    .filter(Boolean).join(', ');
}

export function mapSizes(m) {
  const cols = Math.max(5, m.cols || 30), rows = Math.max(5, m.rows || 20);
  const k = Math.sqrt(1.1e6 / (cols * rows));
  const gen = { width: Math.round(cols * k / 64) * 64, height: Math.round(rows * k / 64) * 64 };
  let px = m.gridPx || 100;
  const maxSide = 8192;
  if (Math.max(cols, rows) * px > maxSide) px = Math.floor(maxSide / Math.max(cols, rows));
  return { gen, final: { width: cols * px, height: rows * px }, gridPx: px };
}

// Foundry VTT scene (import with right click → "Import Data" on a scene)
export function foundryScene(m, meta, imgPath) {
  const light = MAP_LIGHT.find(x => x[0] === m.light) || MAP_LIGHT[0];
  const size = meta.gridPx || m.gridPx || 100;
  return {
    name: meta.title || 'Battlemap',
    width: meta.width, height: meta.height, padding: 0,
    background: { src: imgPath }, img: imgPath,
    grid: { type: m.camera === 'iso' ? 0 : 1, size, distance: 5, units: 'ft', alpha: 0.2, color: '#000000' },
    gridType: m.camera === 'iso' ? 0 : 1, gridDistance: 5, gridUnits: 'ft',
    darkness: light[3], environment: { darknessLevel: light[3], globalLight: { enabled: light[3] < 0.5 } },
    tokenVision: true, fogExploration: true, fog: { exploration: true },
    navigation: true,
    flags: { 'ascandir-charactereditor': { prompt: meta.prompt || '', settings: m } },
  };
}
