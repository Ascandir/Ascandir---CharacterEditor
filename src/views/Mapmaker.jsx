// Mapmaker: battle maps for Foundry VTT with the same image models as the character painter
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { toEn } from '../ai/prompt.js';
import { MAP_CAMERAS, MAP_BIOMES, MAP_SITES, MAP_LIGHT, MAP_WEATHER, MAP_SEASONS, MAP_STYLES, MAP_ASSETS, ASSET_GROUPS, AMOUNTS, MAP_SIZES, DEFAULT_MAP, MAP_NEGATIVE, MAP_NEGATIVE_FLAT, MAP_DEPTH, mapPrompt, mapSizes, foundryScene } from '../ai/mapPrompt.js';
import { useJob, finishJob, cancelJob, fmtTime, jobPct } from '../ai/jobs.js';
import ZoomView, { ImageModal } from '../components/ZoomView.jsx';
import BigText from '../components/BigText.jsx';
import AiSetup from '../components/AiSetup.jsx';
import Advisor from './Advisor.jsx';
import { confirmDialog } from '../components/Dialog.jsx';

const DIR = '_maps';
const MAX_MAPS = 60;

async function toImg(src) { const i = new Image(); i.src = src; await i.decode(); return i; }
async function resized(src, w, h) {
  const img = await toImg(src); const c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h); return c.toDataURL('image/png');
}
// final file: optional grid drawn in, as WebP or PNG
async function exportData(src, meta, m, type) {
  const img = await toImg(src); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  if (m.bakeGrid && meta.cols && meta.rows) {
    const sx = c.width / meta.cols, sy = c.height / meta.rows;
    x.strokeStyle = `rgba(0,0,0,${(m.gridAlpha ?? 25) / 100})`; x.lineWidth = Math.max(1, Math.round(sx / 60));
    x.beginPath();
    for (let i = 1; i < meta.cols; i++) { x.moveTo(Math.round(i * sx) + .5, 0); x.lineTo(Math.round(i * sx) + .5, c.height); }
    for (let j = 1; j < meta.rows; j++) { x.moveTo(0, Math.round(j * sy) + .5); x.lineTo(c.width, Math.round(j * sy) + .5); }
    x.stroke();
  }
  return c.toDataURL(type === 'png' ? 'image/png' : 'image/webp', 0.9);
}
const slug = (s) => String(s || 'battlemap').normalize('NFKD').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'battlemap';

function mapSystem(lang, mode, modelInfo, m) {
  const keys = (list) => list.map(x => x[0]).join('|');
  return `You are an expert for designing top-down battle maps for Dungeons & Dragons in Foundry VTT and for writing prompts for an AI image model.
Talk with the user in ${lang === 'de' ? 'German' : 'English'}. Find out what the map is for: the place and biome, the encounter or scene that happens there, important features and their layout, size in grid squares, lighting and mood.
Think like a game master: good battle maps have cover, open walkable areas, choke points, different heights or difficult terrain, and features placed so that a fight is interesting.
Ask at most 2-3 short questions at a time and make concrete suggestions.
Whenever you have enough information, or the user asks for it, ${mode === 'sliders' ? 'fill in the map maker of the app (see SETTINGS below).' : 'write the final image prompt.'}
${mode === 'sliders' ? `SETTINGS: output one fenced code block that starts with \`\`\`settings and contains only JSON with these keys (leave out keys you do not need):
{"camera":"${keys(MAP_CAMERAS)}","depth":"${keys(MAP_DEPTH)}","biome":"${keys(MAP_BIOMES)}","site":"${keys(MAP_SITES)}","light":"${keys(MAP_LIGHT)}","weather":"${keys(MAP_WEATHER)}","season":"${keys(MAP_SEASONS)}","style":"${keys(MAP_STYLES.filter(x => x[0] !== 'custom'))}",
"assets":{${MAP_ASSETS.map(a => '"' + a[0] + '"').join(',')}: 1-5 amount (1 = one or two / small, 5 = lots / large); only include assets that should appear},
"density":0-100 (how cluttered),"cols":5-60,"rows":5-60 (size in grid squares),"extra":"English text: layout and special details, e.g. where the river runs, where the ruins stand"}
Then explain in 2-3 short sentences (in the user's language) what you set.` : ''}
Target image model: ${modelInfo.name}. ${modelInfo.tips}
Rules for prompts and the "extra" text:
- English, natural descriptive language.
- ${mode === 'sliders' ? 'The app adds camera, style, lighting and the technical rules itself.' : 'Inside a fenced code block that starts with \`\`\`prompt. Start with the art style, then "top-down battle map seen from directly above", the place, the features with their positions, lighting. End with: no grid lines, no text, no people or creatures, the terrain fills the whole image.'}
- Describe positions on the map (top left, center, along the bottom edge ...) so the layout works for a fight.
Current map settings in the app: ${JSON.stringify({ camera: m.camera, biome: m.biome, site: m.site, light: m.light, weather: m.weather, season: m.season, style: m.style, assets: m.assets, density: m.density, cols: m.cols, rows: m.rows, extra: m.extra })}`;
}

export default function Mapmaker({ globalSettings, saveSettings }) {
  const { t, lang } = useT();
  const gsRef = useRef(globalSettings); gsRef.current = globalSettings;
  const ms = globalSettings?.mapmaker || {};
  const m = { ...DEFAULT_MAP, ...(ms.cfg || {}), assets: { ...(ms.cfg?.assets || DEFAULT_MAP.assets) } };
  const maps = ms.maps || [];
  const selName = ms.selected || maps[0]?.name || null;
  const selMeta = maps.find(x => x.name === selName) || null;
  const tab = ms.tab || 'map';
  const saveMS = (fn) => { const g = gsRef.current || {}; const cur = g.mapmaker || {}; const next = fn(cur); gsRef.current = { ...g, mapmaker: next }; saveSettings(gsRef.current); };
  const set = (k, v) => saveMS(c => ({ ...c, cfg: { ...DEFAULT_MAP, ...(c.cfg || {}), [k]: v } }));
  const setMany = (o) => saveMS(c => ({ ...c, cfg: { ...DEFAULT_MAP, ...(c.cfg || {}), ...o } }));
  const setAsset = (k, v) => set('assets', (() => { const a = { ...m.assets }; if (v) a[k] = v; else delete a[k]; return a; })());

  const [st, setSt] = useState(null);
  const refresh = () => api.ai.status().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => { refresh(); return api.ai.on('ai:state', refresh); }, []);
  const ready = st?.supported && st.comfyInstalled && !!st.models?.['z-image-turbo']?.present;
  const hasUpscale = !!st?.models?.upscale?.present;
  const hasQwen = !!st?.models?.['qwen-image-21']?.present;
  const hasQwenTurbo = !!st?.models?.['qwen-image-21-turbo']?.present;
  const model = m.model === 'qwen' && hasQwen ? 'qwen' : m.model === 'qwenturbo' && hasQwenTurbo ? 'qwenturbo' : 'zimage';
  const useQwen = model !== 'zimage';

  const [cache, setCache] = useState({});
  useEffect(() => { for (const x of maps) if (!cache[x.name]) api.loadImage(DIR, x.name).then(u => setCache(c => ({ ...c, [x.name]: u }))).catch(() => {}); }, [maps.map(x => x.name).join()]);
  const selImg = selName ? cache[selName] : null;
  // reference map: Qwen copies its camera angle, scale and art style (not its content)
  const refName = ms.ref?.name || null;
  useEffect(() => { if (refName && !cache[refName]) api.loadImage(DIR, refName).then(u => setCache(c => ({ ...c, [refName]: u }))).catch(() => {}); }, [refName]);
  const refImg = refName ? cache[refName] : null;
  const useRef_ = !!refImg && ms.ref?.on !== false;
  const refFile = useRef(null);
  const setRefFrom = async (dataUrl, label) => {
    // normalise to max 1600 px PNG
    const img = await toImg(dataUrl); const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const url = await resized(dataUrl, Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
    const name = await api.saveImage(DIR, url);
    setCache(c => ({ ...c, [name]: url }));
    if (refName && !maps.some(x => x.name === refName)) api.deleteImage(DIR, refName);
    saveMS(c => ({ ...c, ref: { name, label, on: true } }));
  };
  const importRef = async (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const raw = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    setRefFrom(raw, file.name);
  };

  const [busy, setBusy] = useJob('paint');
  const [err, setErr] = useState(null);
  const [big, setBig] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const prompt = useMemo(() => mapPrompt(m, ms.tr || {}), [JSON.stringify(m), JSON.stringify(ms.tr || {})]);
  const sizes = mapSizes(m);

  const translate = async (raw) => {
    const v = String(raw || '').trim();
    if (!v || ms.tr?.[v] || /^[\x20-\x7e]*$/.test(v) && toEn(v) === v) return;
    const lc = globalSettings?.llm || {};
    try {
      const mm = await api.llm.models({ url: lc.url, key: lc.key });
      const r = await api.llm.chat({ url: lc.url, key: lc.key, model: mm[0], reasoning: 'off', id: -1, messages: [
        { role: 'system', content: 'Translate the user text into concise natural English for an image generation prompt of a fantasy battle map. Keep the meaning exactly. Output only the translation.' },
        { role: 'user', content: v }] });
      const en = String(r.text || '').trim().replace(/^["']|["']$/g, '').split('\n')[0];
      if (en) saveMS(c => ({ ...c, tr: { ...(c.tr || {}), [v]: en } }));
    } catch { /* no text model: word list */ }
  };

  const generate = async (mode, editText) => {
    if (busy) return;
    const src = mode === 'new' ? m : { ...m, ...(selMeta?.cfg || {}) };
    if (mode !== 'new' && !selImg) return;
    const text = (editText ?? m.editText ?? '').trim();
    if (mode === 'edit' && !text) { setErr(t.mmEditEmpty); return; }
    setErr(null);
    setBusy({ mode, seconds: 0, target: 'map', name: t.tabMaps });
    let ok = false, failMsg = null;
    try {
      const lc = globalSettings?.llm || {};
      if (lc.stopBeforePaint !== false) { try { await api.strata.stop({ cmd: lc.cmd }); } catch { /* not running */ } }
      const { gen, final, gridPx } = mapSizes(src);
      const seed = Math.floor(Math.random() * 2 ** 31);
      const basePrompt = mode === 'new' ? prompt : (selMeta?.prompt || prompt);
      const params = { prompt: basePrompt, seed, width: gen.width, height: gen.height, batch: 1, removeBg: false };
      if (hasUpscale && final.width > gen.width) params.upscale = final;
      if (useQwen) {
        const neg = m.strictTop !== false && ['top', '3d'].includes(src.camera) && mode !== 'edit' ? (src.camera === 'top' && (src.depth || 'flat') === 'flat' ? MAP_NEGATIVE_FLAT : MAP_NEGATIVE) : '';
        Object.assign(params, model === 'qwenturbo' ? { model: 'qwen', turbo: true, negative: '', cfg: 1, steps: 8 } : { model: 'qwen', negative: neg, cfg: neg ? 4 : 1, steps: m.qSteps || 30 });
        if (mode !== 'edit' && useRef_) {
          const ri = await toImg(refImg); const k = Math.sqrt(1.0e6 / (ri.naturalWidth * ri.naturalHeight));
          params.refImages = [await resized(refImg, Math.round(ri.naturalWidth * k / 32) * 32, Math.round(ri.naturalHeight * k / 32) * 32)];
          params.resolution = Math.round(Math.sqrt(gen.width * gen.height) / 32) * 32;
          params.prompt = `Create a completely new battle map. Copy exactly the camera of <image1>: perfectly straight top-down at 90 degrees with no tilt. Also copy its scale and its art style, textures and outlines. Do not copy the layout, the buildings or the objects of <image1>. The new map shows: ${basePrompt}`;
        } else if (mode !== 'new') {
          params.refImages = [await resized(selImg, gen.width, gen.height)];
          params.resolution = Math.round(Math.sqrt(gen.width * gen.height) / 32) * 32;
          if (mode === 'edit') {
            params.editLatent = true;
            params.prompt = `Edit <image1>. ${toEn(text, ms.tr)}. Keep everything else exactly as in <image1>: the map layout, the top-down camera, the scale and the art style. No grid lines, no text.`;
          } else {
            params.prompt = `A new variation of the battle map in <image1>: same place, same art style, same camera and scale, but a different layout of the features. ${basePrompt}`;
          }
        }
      } else if (mode !== 'new') {
        params.initImage = await resized(selImg, gen.width, gen.height);
        params.denoise = mode === 'edit' ? Math.max(0.3, Math.min(0.9, (m.strength ?? 55) / 100)) : 0.7;
        if (mode === 'edit') params.prompt = toEn(text, ms.tr) + ', ' + basePrompt;
      }
      const res = await api.ai.generate(params);
      const url = res.images[0];
      const name = await api.saveImage(DIR, url);
      setCache(c => ({ ...c, [name]: url }));
      const img = await toImg(url);
      const biome = (MAP_BIOMES.find(b => b[0] === src.biome) || MAP_BIOMES[0])[1][lang];
      const site = MAP_SITES.find(s => s[0] === src.site);
      const title = (selMeta && mode !== 'new' ? selMeta.title + (mode === 'edit' ? ' ✎' : ' ↻') : biome + (site && site[0] !== 'none' ? ' – ' + site[1][lang] : ''));
      const meta = { name, title, ts: Date.now(), prompt: params.prompt, model, seconds: res.seconds, cols: src.cols, rows: src.rows, width: img.naturalWidth, height: img.naturalHeight, gridPx: Math.round(img.naturalWidth / src.cols), cfg: JSON.parse(JSON.stringify(src)), kind: mode === 'new' ? undefined : mode };
      void gridPx;
      saveMS(c => {
        const all = [meta, ...(c.maps || [])];
        for (const old of all.slice(MAX_MAPS)) api.deleteImage(DIR, old.name);
        return { ...c, maps: all.slice(0, MAX_MAPS), selected: name, cfg: mode === 'edit' ? { ...DEFAULT_MAP, ...(c.cfg || {}), editText: '' } : c.cfg };
      });
      ok = true;
    } catch (e) {
      const msg = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      if (/CANCELLED/.test(msg)) failMsg = 'CANCELLED'; else { setErr(/COMFY_TOO_OLD/.test(msg) ? t.pComfyOld : msg); failMsg = msg; }
    }
    finishJob('paint', ok, failMsg); refresh();
  };

  const selectMap = (name) => saveMS(c => ({ ...c, selected: name }));
  const deleteMap = async () => {
    if (!selMeta || !(await confirmDialog(t.mmDelete(selMeta.title)))) return;
    await api.deleteImage(DIR, selMeta.name);
    saveMS(c => { const rest = (c.maps || []).filter(x => x.name !== selMeta.name); return { ...c, maps: rest, selected: rest[0]?.name || null }; });
  };
  const renameMap = (title) => saveMS(c => ({ ...c, maps: (c.maps || []).map(x => (x.name === selMeta.name ? { ...x, title } : x)) }));

  const exportImage = async (type) => {
    if (!selImg) return;
    const data = await exportData(selImg, selMeta, m, type);
    await api.saveFile({ defaultName: slug(selMeta.title) + '.' + type, filters: [{ name: type.toUpperCase(), extensions: [type] }], dataBase64: data.split(',')[1] });
  };
  const exportFoundry = async () => {
    if (!selImg) return;
    const file = slug(selMeta.title) + '.webp';
    const folder = String(m.folder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const scene = foundryScene({ ...m, ...(selMeta.cfg || {}) }, { ...selMeta }, (folder ? folder + '/' : '') + file);
    const data = await exportData(selImg, selMeta, m, 'webp');
    const json = btoa(unescape(encodeURIComponent(JSON.stringify(scene, null, 2))));
    const dir = await api.saveFilesToDir({ files: [{ name: file, dataBase64: data.split(',')[1] }, { name: slug(selMeta.title) + '.scene.json', dataBase64: json }] });
    if (dir) setShowFoundry(true);
  };
  const [showFoundry, setShowFoundry] = useState(false);

  // ----- advisor adapter -----
  const adapter = {
    messages: ms.advisor?.messages || [],
    setMsgs: (fn) => saveMS(c => ({ ...c, advisor: { ...(c.advisor || {}), messages: fn(c.advisor?.messages || []) } })),
    mode: ms.advisor?.mode || 'sliders',
    set: (k, v) => saveMS(c => ({ ...c, advisor: { ...(c.advisor || {}), [k]: v } })),
    model,
    system: (lg, mode, info) => mapSystem(lg, mode, info, m),
    hasImage: !!selImg,
    getImage: async () => (selImg ? resized(selImg, 1024, Math.round(1024 * (selMeta?.rows || 2) / (selMeta?.cols || 3))) : null),
    placeholder: t.mmAdvPlaceholder, empty: t.mmAdvEmpty,
    applySettings: (s) => {
      const pickKey = (list, v) => (list.some(x => x[0] === v) ? v : undefined);
      const nx = { promptMode: 'sliders' };
      for (const [k, list] of [['camera', MAP_CAMERAS], ['depth', MAP_DEPTH], ['biome', MAP_BIOMES], ['site', MAP_SITES], ['light', MAP_LIGHT], ['weather', MAP_WEATHER], ['season', MAP_SEASONS], ['style', MAP_STYLES]]) { const v = pickKey(list, s[k]); if (v) nx[k] = v; }
      const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined);
      for (const [k, lo, hi] of [['density', 0, 100], ['cols', 5, 60], ['rows', 5, 60]]) { const v = num(s[k], lo, hi); if (v != null) nx[k] = v; }
      if (typeof s.extra === 'string') nx.extra = s.extra;
      if (s.assets && typeof s.assets === 'object') { const a = {}; for (const [k] of MAP_ASSETS) { const v = num(s.assets[k], 0, 5); if (v) a[k] = v; } nx.assets = a; }
      saveMS(c => ({ ...c, tab: 'map', cfg: { ...DEFAULT_MAP, ...(c.cfg || {}), ...nx } }));
    },
    takeOver: (b) => saveMS(c => ({ ...c, tab: 'map', cfg: { ...DEFAULT_MAP, ...(c.cfg || {}), promptMode: 'free', freePrompt: b.prompt } })),
  };

  const chips = (list, k) => <div className="row wrap" style={{ gap: 6 }}>{list.map(([key, l]) => <button key={key} className={'chip' + (m[k] === key ? ' on' : '')} onClick={() => set(k, key)}>{l[lang]}</button>)}</div>;
  const sel = (list, k, label) => (
    <label className="col" style={{ gap: 4 }}><span className="bold small">{label}</span>
      <select value={m[k]} onChange={e => set(k, e.target.value)}>{list.map(([key, l]) => <option key={key} value={key}>{l[lang]}</option>)}</select></label>
  );
  const enHint = (v) => { const x = String(v || '').trim(); const en = x ? (ms.tr?.[x] || toEn(x)) : ''; return x && en && en.toLowerCase() !== x.toLowerCase() ? <span className="muted small">EN: {en}</span> : null; };
  const cam = MAP_CAMERAS.find(c => c[0] === m.camera) || MAP_CAMERAS[0];

  const modelSelect = (
    <label className="row small" style={{ gap: 8 }}>{t.pModel}
      <select value={model} onChange={e => set('model', e.target.value)}>
        <option value="zimage">Z-Image Turbo · {t.pFast}</option>
        {hasQwenTurbo && <option value="qwenturbo">Qwen Image 2.1 Turbo · {t.pQwenTurbo}</option>}
        {hasQwen && <option value="qwen">Qwen Image 2.1 · {t.pBest}</option>}
      </select></label>
  );

  return (
    <div className="col" style={{ gap: 0 }}>
      <div className="row" style={{ padding: '14px 22px 0', gap: 8 }}>
        <div className="seg" style={{ whiteSpace: 'nowrap' }}>
          <button className={tab === 'map' ? 'on' : ''} onClick={() => saveMS(c => ({ ...c, tab: 'map' }))}>{t.mmTabMap}</button>
          <button className={tab === 'advisor' ? 'on' : ''} onClick={() => saveMS(c => ({ ...c, tab: 'advisor' }))}>{t.designerAdvisor}</button>
        </div>
        <div className="grow" />
        {modelSelect}
      </div>
      {tab === 'advisor' ? <Advisor globalSettings={globalSettings} saveSettings={saveSettings} adapter={adapter} /> : (
        <div className="page" style={{ alignItems: 'flex-start' }}>
          <section className="card col" style={{ flex: '1 1 320px', maxWidth: 380, gap: 12 }}>
            <div className="col" style={{ gap: 6 }}>
              <span className="bold small">{t.pSource}</span>
              <div className="seg">
                <button className={m.promptMode !== 'free' ? 'on' : ''} onClick={() => set('promptMode', 'sliders')}>{t.pSourceSliders}</button>
                <button className={m.promptMode === 'free' ? 'on' : ''} onClick={() => set('promptMode', 'free')}>{t.pSourceFree}</button>
              </div>
            </div>
            {m.promptMode === 'free' ? (
              <BigText rows={12} title={t.pSourceFree} value={m.freePrompt || ''} placeholder={t.mmFreeHint} onChange={e => set('freePrompt', e.target.value)} style={{ fontSize: 12, resize: 'vertical' }} />
            ) : <>
              <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.mmCamera}</span>
                {chips(MAP_CAMERAS, 'camera')}
                <span className="muted small">{cam[3][lang]}</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.mmRef}</span>
                {refImg ? (
                  <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                    <img src={refImg} alt="" style={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--line)' }} />
                    <div className="col grow" style={{ gap: 4 }}>
                      <label className="checkline small"><input type="checkbox" checked={ms.ref?.on !== false} onChange={e => saveMS(c => ({ ...c, ref: { ...(c.ref || {}), on: e.target.checked } }))} /><span>{t.mmRefUse}</span></label>
                      <div className="row" style={{ gap: 6 }}>
                        <button className="btn sm" onClick={() => refFile.current?.click()}>{t.mmRefOther}</button>
                        <button className="btn sm ghost" onClick={() => saveMS(c => ({ ...c, ref: null }))}>×</button>
                      </div>
                    </div>
                  </div>
                ) : <button className="btn sm" onClick={() => refFile.current?.click()}>{t.mmRefLoad}</button>}
                <input ref={refFile} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { importRef(e.target.files?.[0]); e.target.value = ''; }} />
                <span className="muted small">{useQwen ? t.mmRefHint : t.mmRefQwenOnly}</span>
              </div>
              {m.camera === 'top' && <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.mmDepth}</span>
                {chips(MAP_DEPTH, 'depth')}
                <span className="muted small">{(MAP_DEPTH.find(x => x[0] === m.depth) || MAP_DEPTH[0])[3][lang]}</span>
              </div>}
              {sel(MAP_BIOMES, 'biome', t.mmBiome)}
              {sel(MAP_SITES, 'site', t.mmSite)}
              <div className="col" style={{ gap: 6 }}><span className="bold small">{t.mmLight}</span>{chips(MAP_LIGHT, 'light')}</div>
              <div className="row" style={{ gap: 10 }}>
                <div className="grow">{sel(MAP_WEATHER, 'weather', t.mmWeather)}</div>
                <div className="grow">{sel(MAP_SEASONS, 'season', t.mmSeason)}</div>
              </div>
              <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.mmAssets}</span>
                {ASSET_GROUPS.map(([g, gl]) => (
                  <details key={g} open={MAP_ASSETS.some(a => a[3] === g && m.assets[a[0]])}>
                    <summary className="small" style={{ cursor: 'pointer' }}>{gl[lang]} {MAP_ASSETS.filter(a => a[3] === g && m.assets[a[0]]).length ? '· ' + MAP_ASSETS.filter(a => a[3] === g && m.assets[a[0]]).length : ''}</summary>
                    <div className="col" style={{ gap: 4, marginTop: 6 }}>
                      {MAP_ASSETS.filter(a => a[3] === g).map(([k, l]) => {
                        const v = m.assets[k] || 0;
                        return (
                          <div key={k} className="small" style={{ display: 'grid', gridTemplateColumns: '150px 1fr 64px', alignItems: 'center', gap: 8, minHeight: 26 }}>
                            <label className="row" style={{ gap: 6, flexWrap: 'nowrap' }}><input type="checkbox" checked={!!v} onChange={e => setAsset(k, e.target.checked ? 3 : 0)} />{l[lang]}</label>
                            {!!v && <>
                              <input type="range" min={1} max={5} value={v} onChange={e => setAsset(k, Number(e.target.value))} style={{ minWidth: 0 }} aria-label={l[lang]} />
                              <span className="muted" style={{ minWidth: 62, textAlign: 'right' }}>{AMOUNTS[v - 1][1][lang]}</span>
                            </>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </div>
              <div>
                <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="mm-dens" className="bold small">{t.mmDensity}</label><span className="muted small">{m.density < 25 ? t.mmSparse : m.density < 60 ? t.mmBalanced : m.density < 85 ? t.mmBusy : t.mmCluttered}</span></div>
                <input id="mm-dens" type="range" min={0} max={100} value={m.density} onChange={e => set('density', Number(e.target.value))} />
              </div>
              <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.mmStyle}</span>
                {chips(MAP_STYLES, 'style')}
                {m.style === 'custom' && <><input value={m.customStyle || ''} placeholder={t.pCustomStyleHint} onChange={e => set('customStyle', e.target.value)} onBlur={() => translate(m.customStyle)} />{enHint(m.customStyle)}</>}
              </div>
              <label className="col" style={{ gap: 4 }}><span className="bold small">{t.mmExtra}</span>
                <BigText rows={3} title={t.mmExtra} value={m.extra || ''} placeholder={t.mmExtraHint} onChange={e => set('extra', e.target.value)} onBlur={() => translate(m.extra)} />
                {enHint(m.extra)}</label>
            </>}
            <label className="checkline small"><input type="checkbox" checked={!!m.noCreatures} onChange={e => set('noCreatures', e.target.checked)} /><span>{t.mmNoCreatures}</span></label>
            <div className="col" style={{ gap: 6 }}>
              <span className="bold small">{t.mmSize} <span className="muted">· {sizes.final.width} × {sizes.final.height} px{!hasUpscale ? ' (' + t.mmNoUpscale + ')' : ''}</span></span>
              <div className="row wrap" style={{ gap: 6 }}>{MAP_SIZES.map(([c, r, l]) => <button key={c + 'x' + r} className={'chip' + (m.cols === c && m.rows === r ? ' on' : '')} onClick={() => setMany({ cols: c, rows: r })}>{l[lang]}</button>)}</div>
              <div className="row small" style={{ gap: 8 }}>
                <label className="row" style={{ gap: 4 }}>{t.mmCols}<input type="number" min={5} max={60} value={m.cols} onChange={e => set('cols', Math.max(5, Math.min(60, Number(e.target.value) || 5)))} style={{ width: 64 }} /></label>
                <label className="row" style={{ gap: 4 }}>{t.mmRows}<input type="number" min={5} max={60} value={m.rows} onChange={e => set('rows', Math.max(5, Math.min(60, Number(e.target.value) || 5)))} style={{ width: 64 }} /></label>
                <label className="row" style={{ gap: 4 }}>{t.mmGridPx}<select value={m.gridPx} onChange={e => set('gridPx', Number(e.target.value))}>{[70, 100, 140, 200].map(n => <option key={n} value={n}>{n} px</option>)}</select></label>
              </div>
              <span className="muted small">{t.mmSizeHint}</span>
            </div>
            {useQwen && model === 'qwen' && (
              <div className="col" style={{ gap: 6 }}>
                <span className="bold small">{t.pSteps}</span>
                <div className="row wrap" style={{ gap: 6 }}>{[[20, t.pStepsFast], [30, t.pStepsStd], [45, t.pStepsBest]].map(([n, l]) => <button key={n} className={'chip' + ((m.qSteps || 30) === n ? ' on' : '')} onClick={() => set('qSteps', n)}>{l} · {n}</button>)}</div>
                <label className="checkline small"><input type="checkbox" checked={m.strictTop !== false} onChange={e => set('strictTop', e.target.checked)} /><span>{t.mmStrictTop}<br /><span className="muted">{t.mmStrictTopHint}</span></span></label>
              </div>
            )}
            <button className="btn sm ghost" onClick={() => setShowPrompt(!showPrompt)}>{t.pPrompt} {showPrompt ? '▾' : '▸'}</button>
            {showPrompt && <BigText rows={7} readOnly value={prompt} title={t.pPrompt} style={{ fontSize: 12 }} />}
          </section>

          <section className="col" style={{ flex: '999 1 460px', minWidth: 0 }}>
            {st && !ready && (
              <div className="card col">
                <h3 style={{ margin: 0 }}>{t.aiSetupTitle}</h3>
                {st.supported ? <AiSetup compact onDone={refresh} /> : <div className="banner info" style={{ margin: 0 }}>{t.aiWinOnly}</div>}
              </div>
            )}
            {ready && (
              <div className="card row wrap" style={{ padding: 12, gap: 8 }}>
                <span className="dot" style={{ background: st.running ? 'var(--ok)' : 'var(--dim)' }} />
                <span className="small">{st.running ? t.aiRunning : t.aiStopped}</span>
                <div className="grow" />
                <button className="btn primary" disabled={!!busy} onClick={() => generate('new')}>{t.mmGenerate}</button>
                <button className="btn" disabled={!!busy || !selImg} onClick={() => generate('variant')} title={t.mmVariantHint}>{t.mmVariant}</button>
              </div>
            )}
            {ready && selImg && (
              <div className="card col" style={{ padding: 12, gap: 8 }}>
                <span className="bold small">{t.mmEdit}</span>
                <div className="row" style={{ gap: 8 }}>
                  <input className="grow" value={m.editText || ''} placeholder={t.mmEditHint} onChange={e => set('editText', e.target.value)} onBlur={() => translate(m.editText)} onKeyDown={e => { if (e.key === 'Enter') generate('edit'); }} />
                  <button className="btn" disabled={!!busy || !(m.editText || '').trim()} onClick={() => generate('edit')}>{t.pRelApply}</button>
                </div>
                {enHint(m.editText)}
                <div className="row wrap small" style={{ gap: 6 }}>
                  <span className="muted">{t.mmQuick}:</span>
                  {[[t.mmQNight, 'the same map at night, dark moonlit, a few warm lights from fires and windows'], [t.mmQWinter, 'the same map in winter, covered in snow'], [t.mmQAutumn, 'the same map in autumn with orange and red foliage'], [t.mmQRain, 'the same map in heavy rain, wet ground and puddles'], [t.mmQRuin, 'the same map after a battle: destroyed, burned and broken'], [t.mmQFog, 'the same map with thick fog patches']].map(([l, txt]) => (
                    <button key={l} className="chip" disabled={!!busy} onClick={() => generate('edit', txt)}>{l}</button>
                  ))}
                </div>
                {!useQwen && <div className="row small" style={{ gap: 8 }}>
                  <label htmlFor="mm-str" className="muted">{t.pStrength}</label>
                  <input id="mm-str" type="range" min={30} max={90} value={m.strength} onChange={e => set('strength', Number(e.target.value))} style={{ maxWidth: 220 }} />
                  <span className="muted">{m.strength} %</span>
                  <span className="muted">{t.pRelZimage}</span>
                </div>}
              </div>
            )}
            {busy && <div className="banner info" style={{ margin: 0, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div className="row" style={{ gap: 10 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /><span className="grow">{busy.cancelling ? t.pCancelling : busy.target === 'map' ? t.mmPainting : t.jobPaint} · {fmtTime(busy.seconds)}</span>
                <button className="btn sm" disabled={busy.cancelling} onClick={() => cancelJob('paint')}>{t.cancel}</button></div>
              {!busy.cancelling && <div className="col" style={{ gap: 4 }}>
                <div className={'progbar' + (jobPct(busy) == null ? ' indet' : '')}><i style={{ width: (jobPct(busy) ?? 30) + '%' }} /></div>
                <span className="muted small">{busy.stage === 'sample' ? t.progStep(busy.step, busy.total) + (busy.eta != null ? ' · ' + t.progEta(fmtTime(busy.eta)) : '') + ' · ' + jobPct(busy) + ' %' : busy.stage === 'post' ? t.mmPost : t.progLoading}</span>
              </div>}
            </div>}
            {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small" style={{ whiteSpace: 'pre-wrap' }}>{err}</span></div>}
            <ZoomView src={selImg} empty={t.mmEmpty} labels={{ fit: t.zoomFit, hint: t.zoomHint, open: t.zoomOpen }} onOpen={() => setBig(true)} />
            {big && <ImageModal src={selImg} onClose={() => setBig(false)} labels={{ fit: t.zoomFit, hint: t.zoomHint, close: t.close }} />}
            {maps.length > 0 && (
              <div className="row" style={{ gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
                {maps.map(x => (
                  <button key={x.name} className="checker" onClick={() => selectMap(x.name)} title={x.title}
                    style={{ position: 'relative', flex: 'none', width: 120, height: 84, borderRadius: 8, border: '2px solid ' + (x.name === selName ? 'var(--accent)' : 'var(--line)'), padding: 0, overflow: 'hidden' }}>
                    {cache[x.name] && <img src={cache[x.name]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {x.kind && <span className="badge" style={{ position: 'absolute', left: 3, top: 3 }}>{x.kind === 'edit' ? '✎' : '↻'}</span>}
                  </button>
                ))}
              </div>
            )}
          </section>

          <aside className="col" style={{ flex: '1 1 240px', maxWidth: 290 }}>
            <div className="card col" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>{t.mmExport}</h3>
              {!selMeta ? <span className="muted small">{t.mmNoMap}</span> : <>
                <label className="col small" style={{ gap: 4 }}><span className="muted">{t.mmTitle}</span>
                  <input value={selMeta.title || ''} onChange={e => renameMap(e.target.value)} /></label>
                <span className="muted small">{selMeta.cols} × {selMeta.rows} {t.mmSquares} · {selMeta.width} × {selMeta.height} px · {selMeta.gridPx} px/{t.mmSquare}</span>
                <label className="checkline small"><input type="checkbox" checked={!!m.bakeGrid} onChange={e => set('bakeGrid', e.target.checked)} /><span>{t.mmBakeGrid}</span></label>
                {m.bakeGrid && <div className="row small" style={{ gap: 6 }}><span className="muted">{t.mmGridAlpha}</span><input type="range" min={5} max={80} value={m.gridAlpha} onChange={e => set('gridAlpha', Number(e.target.value))} /><span className="muted">{m.gridAlpha} %</span></div>}
                <label className="col small" style={{ gap: 4 }}><span className="muted">{t.mmFolder}</span>
                  <input value={m.folder || ''} placeholder="battlemaps" onChange={e => set('folder', e.target.value)} /></label>
                <button className="btn primary" onClick={exportFoundry}>{t.mmExportFoundry}</button>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn sm grow" onClick={() => exportImage('webp')}>WebP</button>
                  <button className="btn sm grow" onClick={() => exportImage('png')}>PNG</button>
                </div>
                <button className="btn sm" onClick={() => setRefFrom(selImg, selMeta.title)}>{t.mmRefFromSel}</button>
                <button className="btn sm danger" onClick={deleteMap}>{t.delete}</button>
              </>}
            </div>
          </aside>
        </div>
      )}
      {showFoundry && (
        <div className="modal-bg" onClick={() => setShowFoundry(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()} role="dialog" aria-label={t.mmFoundryTitle}>
            <div className="row"><h2 className="serif grow" style={{ margin: 0 }}>{t.mmFoundryTitle}</h2><button className="btn ghost" onClick={() => setShowFoundry(false)}>{t.close}</button></div>
            <ol className="small" style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>{t.mmFoundrySteps(m.folder || 'battlemaps').map((s, i) => <li key={i}>{s}</li>)}</ol>
          </div>
        </div>
      )}
    </div>
  );
}
