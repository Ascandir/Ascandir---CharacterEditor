import React, { useEffect, useMemo, useRef, useState } from 'react';
import BigText from '../components/BigText.jsx';
import ZoomView, { ImageModal } from '../components/ZoomView.jsx';
import { splitViews } from '../ai/images.js';
import { useJob, useJobs, finishJob, cancelJob, fmtTime, jobPct } from '../ai/jobs.js';
import { promptDialog, confirmDialog } from '../components/Dialog.jsx';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { freePrompt, toEn, buildPrompt, frameSize, removeBackground, STYLES, MIX_PARTS, MIX_MODS, PRESET_MIX, mixStyleText, styleOf, FRAMINGS, DEFAULT_PAINTER, typicalHeight, speciesAge, isMinorAge, MULTI_SIZE, BODY_PARTS, RESOLUTIONS, bodyText, upscaleSize, EDIT_GLOBAL, EDIT_TEXT, editChanges, speciesNegative, isWideSpecies } from '../ai/prompt.js';
import { RINGS, composeToken } from '../three/token.js';
import AiSetup from '../components/AiSetup.jsx';

const MAX_PAINTINGS = 40;

async function toImg(src) { const i = new Image(); i.src = src; await i.decode(); return i; }

function drawCroppedToken(ctx, size, img, crop, tk) {
  const off = document.createElement('canvas'); off.width = off.height = size;
  const o = off.getContext('2d');
  if (img) {
    const side = img.naturalWidth * (crop.size / 100);
    const cx = img.naturalWidth * (crop.x / 100); const cy = img.naturalHeight * (crop.y / 100);
    const scale = size / side;
    o.drawImage(img, -(cx - side / 2) * scale, -(cy - side / 2) * scale, img.naturalWidth * scale, img.naturalHeight * scale);
  }
  composeToken(ctx, size, off, { ring: tk.tokenRing || 'gold', color: tk.tokenColor || '#E3A74B', bg: tk.tokenBg || '#2a2e36', transparentBg: !!tk.tokenTransparent });
}

async function onGrey(dataUrl) { // flatten transparency on light grey for img2img
  const img = await toImg(dataUrl);
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
  return c.toDataURL('image/png');
}

// init image for the multi-angle sheet: the selected character placed into every view slot
async function multiInit(dataUrl) {
  const { width: W, height: H, views } = MULTI_SIZE;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, W, H);
  const img = await toImg(dataUrl); const slot = W / views;
  const sc = Math.min((slot * 0.92) / img.naturalWidth, (H * 0.94) / img.naturalHeight);
  const w = img.naturalWidth * sc, h = img.naturalHeight * sc;
  for (let i = 0; i < views; i++) {
    x.save(); x.translate(slot * i + slot / 2, H / 2);
    if (i === 3) x.scale(-1, 1); // left-facing slot mirrored
    x.drawImage(img, -w / 2, -h / 2, w, h); x.restore();
  }
  return c.toDataURL('image/png');
}

export default function Painter({ ch, d, update, globalSettings, saveSettings }) {
  const { t, lang } = useT();
  const p = { ...DEFAULT_PAINTER, ...(ch.painter || {}), crop: { ...DEFAULT_PAINTER.crop, ...(ch.painter?.crop || {}) }, wide: isWideSpecies(d?.race?.name) };
  const tk = { tokenRing: 'gold', tokenColor: '#E3A74B', tokenBg: '#2a2e36', tokenTransparent: false, ...(ch.appearance || {}) };
  const set = (k, v) => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), [k]: v }; return c; });
  const setTk = (k, v) => update(c => { c.appearance = { ...(c.appearance || {}), [k]: v }; return c; });
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useJob('paint'); // {mode, seconds, charId}
  const lastDone = useJobs().done;
  const [err, setErr] = useState(null);
  const [cache, setCache] = useState({});
  const count = 1; // always one picture per run
  const [showSetup, setShowSetup] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [big, setBig] = useState(false);
  const savedStyles = globalSettings?.customStyles || [];
  const curSaved = p.style === 'custom' ? savedStyles.find(x => x.id === p.savedStyleId) : null;
  const mixMode = p.styleMode === 'mix';
  const mix = p.mix || {};
  const curMixSaved = mixMode ? savedStyles.find(x => x.id === p.mixSavedId && x.mix) : null;
  const sameMix = (a, b) => [...MIX_PARTS, ...MIX_MODS].every(([k]) => (a?.[k] ?? (MIX_PARTS.some(x => x[0] === k) ? 0 : 50)) === (b?.[k] ?? (MIX_PARTS.some(x => x[0] === k) ? 0 : 50)));
  const tokenRef = useRef(null);
  const paintings = ch.paintings || [];
  const selName = ch.selectedPainting || paintings[0]?.name;
  const selImg = cache[selName];
  const raceH = typicalHeight(d?.race?.name);
  const autoPrompt = useMemo(() => buildPrompt(d, ch, p), [d, ch.inventory, JSON.stringify(p)]);
  const isFree = p.promptMode === 'free';
  const prompt = isFree ? freePrompt(p) : (p.promptOverride ?? autoPrompt);
  const multiPrompt = useMemo(() => (isFree ? freePrompt(p, { multi: true }) : buildPrompt(d, ch, p, { multi: true })), [d, ch.inventory, JSON.stringify(p)]);
  const selMeta = paintings.find(x => x.name === selName);
  const fileRef = useRef(null);
  const importImage = async (file) => {
    if (!file || !/^image\//.test(file.type)) return;
    const raw = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    // normalise to PNG, max 1600 px on the long side
    const img = await toImg(raw); const sc = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * sc); c.height = Math.round(img.naturalHeight * sc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/png');
    const name = await api.saveImage(ch.id, url);
    setCache(x => ({ ...x, [name]: url }));
    update(x => {
      // imported pictures open in the edit view (own sliders, nothing from the character sheet)
      x.painter = { ...DEFAULT_PAINTER, ...(x.painter || {}), edit: {} };
      const all = [{ name, seed: 0, prompt: '', ts: Date.now(), kind: 'import', file: file.name, rel: true }, ...(x.paintings || [])];
      for (const old of all.slice(MAX_PAINTINGS)) api.deleteImage(x.id, old.name);
      x.paintings = all.slice(0, MAX_PAINTINGS); x.selectedPainting = name; return x;
    });
  };

  // edit view: imported pictures (and results of edits) are changed only by the edit sliders, nothing from the character sheet
  const [editOn, setEditOn] = useState(!!selMeta?.rel);
  useEffect(() => { setEditOn(!!selMeta?.rel); }, [selName]);
  const edit = p.edit || {};
  const setEdit = (k, v) => set('edit', { ...edit, [k]: v });
  const editList = editChanges(edit, p.tr || {}, { minor: isMinorAge(d?.race?.name, p.age) });
  const refresh = () => api.ai.status().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => { refresh(); const off2 = api.ai.on('ai:state', refresh); return () => { off2(); }; }, []);
  // load thumbnails/images lazily
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const pt of paintings) {
        if (cache[pt.name]) continue;
        try { const url = await api.loadImage(ch.id, pt.name); if (alive && url) setCache(c => ({ ...c, [pt.name]: url })); } catch { /* missing file */ }
      }
    })();
    return () => { alive = false; };
  }, [paintings.map(x => x.name).join(), ch.id]);
  // token preview
  useEffect(() => {
    const c = tokenRef.current; if (!c) return;
    (async () => { const img = selImg ? await toImg(selImg) : null; drawCroppedToken(c.getContext('2d'), c.width, img, p.crop, tk); })();
  }, [selImg, JSON.stringify(p.crop), tk.tokenRing, tk.tokenColor, tk.tokenBg, tk.tokenTransparent]);

  const ready = st?.supported && st.comfyInstalled && !!st.models?.['z-image-turbo']?.present;
  const hasBiRef = !!st?.models?.birefnet?.present;
  const hasUpscale = !!st?.models?.upscale?.present;
  const hasQwen = !!st?.models?.['qwen-image-21']?.present;
  const hasQwenTurbo = !!st?.models?.['qwen-image-21-turbo']?.present;
  const qTurbo = hasQwenTurbo && p.model === 'qwenturbo';
  const useQwen = (hasQwen && p.model === 'qwen') || qTurbo;
  const installModel = async (id) => {
    setBgInstall('…'); setErr(null);
    const off = api.ai.on('ai:progress', pr => setBgInstall((pr.pct ?? 0) + ' %'));
    try { await api.ai.install({ dir: st.dir, gpu: st.gpu, models: [id], comfy: false }); } catch (e) { setErr(String(e.message || e)); }
    off(); setBgInstall(null); refresh();
  };
  const [bgInstall, setBgInstall] = useState(null);

  const [ramWarn, setRamWarn] = useState(null); // {mode, freeGB, strata}
  const generate = async (mode, skipRamCheck = false) => {
    if (busy) return;
    const relMode = mode === 'edit' && !!selImg;
    if (relMode && !editList.length) { setErr(t.pRelNothing); return; }
    // edit: the picture keeps its own aspect ratio (about 1 megapixel)
    let editSize = null;
    if (relMode) { const im = await toImg(selImg); const k = Math.sqrt(1.0e6 / (im.naturalWidth * im.naturalHeight)); editSize = { width: Math.max(256, Math.round(im.naturalWidth * k / 64) * 64), height: Math.max(256, Math.round(im.naturalHeight * k / 64) * 64) }; }
    // Qwen keeps ~30 GB of model data in RAM (16 GB card): check free memory first (Strata alone can take 40+ GB)
    if (useQwen && !skipRamCheck) {
      const lc = globalSettings?.llm || {};
      if (lc.stopBeforePaint !== false) { try { await api.strata.stop({ cmd: lc.cmd }); } catch { /* not running */ } }
      // ComfyUI keeps the last model in RAM: the same model is simply reused, so no check is needed;
      // a different model is unloaded first, then the free RAM is checked
      const want = qTurbo ? 'qwenturbo' : 'qwen';
      const cur = await api.ai.status().catch(() => null);
      const reuse = cur?.running && cur.lastModel === want;
      if (!reuse && cur?.running && cur.lastModel) await api.ai.free?.();
      const mem = reuse ? null : await api.mem?.().catch(() => null);
      if (mem && mem.freeGB < 30) {
        let strata = false; try { await api.llm.models({ url: lc.url, key: lc.key }); strata = true; } catch { /* not running */ }
        setRamWarn({ mode, freeGB: mem.freeGB, totalGB: mem.totalGB, strata });
        return;
      }
    }
    setRamWarn(null);
    const jobChar = ch.id;
    // the job keeps running when this view is left: results go to the character it was started for
    const applyTo = (fn) => update(c => {
      if (c.id === jobChar) return fn(c);
      api.loadChar(jobChar).then(o => { if (o) api.saveChar(fn(o)); }).catch(() => {});
      return c;
    });
    let ok = false; let failMsg = null;
    setErr(null); setBusy({ mode, seconds: 0, charId: jobChar, name: ch.name });
    try {
      // free the GPU: stop Strata if this app started it (setting in the AI advisor)
      const lc = globalSettings?.llm || {};
      if (lc.stopBeforePaint !== false) { try { await api.strata.stop({ cmd: lc.cmd }); } catch { /* not running */ } }
      const multi = mode === 'multi';
      const { width, height } = multi ? MULTI_SIZE : editSize || frameSize(p);
      const seed = Math.floor(Math.random() * 2 ** 31);
      // shape sliders changed since the selected picture was made → push them to the front and allow bigger changes
      const prev = selMeta?.params;
      const changed = mode === 'refine' ? BODY_PARTS.map(b => b[0]).filter(k => (prev?.body?.[k] ?? 50) !== (p.body?.[k] ?? 50)) : [];
      const shapeChanged = changed.length > 0 || (mode === 'refine' && prev && ['build', 'curvy', 'muscle', 'height', 'attract'].some(k => prev[k] !== p[k]));
      const emphasis = changed.length && !isMinorAge(d?.race?.name, p.age) ? bodyText({ ...p, body: Object.fromEntries(changed.map(k => [k, p.body?.[k] ?? 50])) }, changed).filter(x => !/^exaggerated stylised/.test(x)) : [];
      const usedPrompt = multi ? multiPrompt : (mode === 'refine' && emphasis.length && (isFree || p.promptOverride == null) ? (isFree ? freePrompt(p, { emphasis }) : buildPrompt(d, ch, p, { emphasis })) : prompt);
      const params = { prompt: usedPrompt, seed, width, height, batch: multi ? 1 : mode === 'refine' ? Math.min(count, 2) : count, removeBg: (multi || p.removeBg) && hasBiRef };
      if (!multi && !relMode && upscaleSize(p) && hasUpscale) params.upscale = upscaleSize(p);
      if (useQwen) {
        // Qwen Image 2.1: native up to 2K, edit/reference mode instead of img2img
        const neg = relMode ? '' : [styleOf(p).negative, styleOf(p).negative ? speciesNegative(d?.race?.name) : ''].filter(Boolean).join(', ');
        Object.assign(params, qTurbo ? { model: 'qwen', turbo: true, negative: '', cfg: 1, steps: 8 } : { model: 'qwen', negative: neg, cfg: neg ? 4 : 1, steps: p.qSteps || 30 });
        if (!multi && !relMode && ['2k', '4k'].includes(p.res)) { const k = 2048 / Math.max(width, height); params.width = Math.round(width * k / 32) * 32; params.height = Math.round(height * k / 32) * 32; if (p.res === '2k') delete params.upscale; }
        // GPU-friendly mode: Qwen paints at most ~1 MP; bigger sizes are reached with the upscaler (driver resets otherwise)
        if (!multi && !relMode && (st?.gpuMode || 'safe') === 'safe' && params.width * params.height > 1.15e6) {
          const target = params.upscale || { width: params.width, height: params.height };
          const k = Math.sqrt(1.0e6 / (params.width * params.height));
          params.width = Math.round(params.width * k / 32) * 32; params.height = Math.round(params.height * k / 32) * 32;
          if (hasUpscale) params.upscale = target; else delete params.upscale;
        }
        if (relMode) {
          params.refImages = [selImg]; params.editLatent = true;
          params.resolution = Math.round(Math.sqrt(params.width * params.height) / 32) * 32;
          params.prompt = `Edit <image1>. Make only these changes: ${editList.join('; ')}. Keep everything else exactly as in <image1>: the identity, face, outfit, colors, pose, framing, background and art style.`;
        } else if (mode === 'refine' && selImg) {
          params.refImages = [selImg]; params.editLatent = true;
          params.resolution = Math.round(Math.sqrt(params.width * params.height) / 32) * 32;
          params.prompt = `Edit <image1>. ${(p.editText || '').trim() ? p.editText.trim() + '. ' : ''}${emphasis.length ? 'Most important change: ' + emphasis.join(', ') + '. ' : ''}The edited character must match this description: ${usedPrompt}. Keep the identity, face, pose, framing and art style of <image1> unless the description asks for something different.`;
        }
        if (multi) {
          params.width = MULTI_SIZE.width; params.height = MULTI_SIZE.height;
          if (selImg && p.multiFromSel !== false && selMeta?.kind !== 'multi') {
            params.refImages = [selImg]; params.resolution = 1024;
            params.prompt = `Use the character in <image1> as the exact reference: same face, body, proportions, outfit, colors and art style. Create ${multiPrompt}`;
          }
        }
        // Qwen Image 2.1 can paint a transparent background itself (RGBA): cleaner than cutting it out afterwards
        if (params.removeBg !== undefined && (multi || p.removeBg) && !params.upscale && p.qwenAlpha !== false) {
          params.prompt = `This is an RGBA format image with transparency. ${params.prompt.replace(/,?\s*plain flat (uniform light grey studio|light grey) background[^,]*(, no shadow on the floor)?(, no scenery)?(, no text)?(, no labels)?(, no frames between the views)?/g, '')}. The image has an alpha channel and a transparent background.`;
          params.removeBg = false; params.nativeAlpha = true;
        }
      } else {
      if (relMode) {
        params.initImage = await onGrey(selImg);
        params.prompt = [...editList, 'the same character as in the picture, same outfit, same colors, same art style'].join(', ');
        params.denoise = Math.max(0.15, Math.min(0.9, (p.editStrength ?? 55) / 100));
      } else if (mode === 'refine' && selImg) { params.initImage = await onGrey(selImg); params.denoise = Math.max(shapeChanged ? 0.68 : 0.15, Math.min(0.9, p.strength / 100)); }
      if (multi && selImg && p.multiFromSel !== false && selMeta?.kind !== 'multi') { params.initImage = await multiInit(await onGrey(selImg)); params.denoise = Math.max(0.4, Math.min(0.95, (p.multiStrength ?? 78) / 100)); }
      }
      const res = await api.ai.generate(params);
      const saved = [];
      for (const [i, raw] of res.images.entries()) {
        const url = (multi || p.removeBg) && !hasBiRef && !params.nativeAlpha ? await removeBackground(raw) : raw;
        const name = await api.saveImage(ch.id, url);
        setCache(c => ({ ...c, [name]: url }));
        saved.push({ name, seed: seed + i, prompt: params.prompt, model: useQwen ? 'qwen' : 'zimage', ts: Date.now(), seconds: res.seconds, params: JSON.parse(JSON.stringify(p)), ...(multi ? { kind: 'multi' } : {}), ...(relMode ? { rel: true, kind: 'edit', changes: editList } : {}) });
      }
      ok = true;
      applyTo(c => {
        const all = [...saved, ...(c.paintings || [])];
        for (const old of all.slice(MAX_PAINTINGS)) api.deleteImage(c.id, old.name);
        c.paintings = all.slice(0, MAX_PAINTINGS); c.selectedPainting = saved[0]?.name;
        if (relMode) c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), edit: {} }; // the result is the new starting point
        return c;
      });
    } catch (e) {
      let m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      if (/stopped unexpectedly|ran out of memory/.test(m) && useQwen) {
        let llmUp = false; try { await api.llm.models({ url: globalSettings?.llm?.url, key: globalSettings?.llm?.key }); llmUp = true; } catch { /* not running */ }
        const mem = await api.mem?.().catch(() => null);
        m = (llmUp ? t.pCrashLlm + '\n\n' : (mem && mem.freeGB < 30 ? t.pCrashQwen + '\n\n' : '')) + m;
      }
      if (!/CANCELLED/.test(m)) { setErr(/COMFY_TOO_OLD/.test(m) ? 'COMFY_TOO_OLD' : m); failMsg = m; } else failMsg = 'CANCELLED';
    }
    finishJob('paint', ok, failMsg); refresh();
  };

  const fname = (ch.name || 'character').replace(/[^\w-]+/g, '_');
  const exportPng = async () => selImg && api.saveFile({ defaultName: fname + '.png', filters: [{ name: 'PNG', extensions: ['png'] }], dataBase64: selImg.split(',')[1] });
  const exportToken = async () => {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    drawCroppedToken(c.getContext('2d'), 1024, selImg ? await toImg(selImg) : null, p.crop, tk);
    await api.saveFile({ defaultName: fname + '-token.png', filters: [{ name: 'PNG', extensions: ['png'] }], dataBase64: c.toDataURL('image/png').split(',')[1] });
  };
  const exportViews = async () => {
    if (!selImg) return;
    const views = await splitViews(selImg);
    const names = ['front', 'right', 'back', 'left'];
    await api.saveFilesToDir({ files: views.map((v, i) => ({ name: `${fname}-${i + 1}-${names[i]}.png`, dataBase64: v.split(',')[1] })) });
  };
  const usePortrait = async () => {
    if (!selImg) return;
    const img = await toImg(selImg); const c = document.createElement('canvas');
    const sc = 400 / img.naturalHeight; c.width = Math.round(img.naturalWidth * sc); c.height = 400;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    update(x => { x.portrait = c.toDataURL('image/png'); return x; });
  };

  const slider = (k, label, min, max, lo, hi, unit = '', value = p[k]) => (
    <div key={k}>
      <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'pt-' + k} className="bold small">{label}</label><span className="muted small">{value}{unit}</span></div>
      <input id={'pt-' + k} type="range" min={min} max={max} value={value} onChange={e => set(k, Number(e.target.value))} />
      <div className="row muted small" style={{ justifyContent: 'space-between' }}><span>{lo}</span><span>{hi}</span></div>
    </div>
  );
  // German input: translated to English for the prompt (by the local text model if it is running, otherwise a word list)
  const translate = (k) => translateVal(p[k]);
  const translateVal = async (raw) => {
    const v = String(raw || '').trim();
    if (!v || p.tr?.[v] || /^[\x20-\x7e]*$/.test(v) && toEn(v) === v) return;
    const lc = globalSettings?.llm || {};
    try {
      const m = await api.llm.models({ url: lc.url, key: lc.key });
      const r = await api.llm.chat({ url: lc.url, key: lc.key, model: m[0], reasoning: 'off', id: -1, messages: [
        { role: 'system', content: 'Translate the user text into concise natural English for an image generation prompt. Keep the meaning exactly, use common hairstyle/clothing/anatomy terms. Output only the translation, nothing else.' },
        { role: 'user', content: v }] });
      const en = String(r.text || '').trim().replace(/^["']|["']$/g, '').split('\n')[0];
      if (en) update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), tr: { ...(c.painter?.tr || {}), [v]: en } }; return c; });
    } catch { /* no text model running: the word list is used */ }
  };
  const text = (k, label, ph) => {
    const v = String(p[k] || '').trim();
    const en = v ? (p.tr?.[v] || toEn(v)) : '';
    return (
      <label key={k} className="col" style={{ gap: 4 }}><span className="muted small">{label}</span>
        <input value={p[k] || ''} placeholder={ph} onChange={e => set(k, e.target.value)} onBlur={() => translate(k)} />
        {v && en && en.toLowerCase() !== v.toLowerCase() && <span className="muted small" title={t.pEnHint}>EN: {en}</span>}
      </label>
    );
  };

  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <section className="card col" style={{ flex: '1 1 300px', maxWidth: 360, gap: 12 }}>
        {editOn && selImg ? <>
          <div className="col" style={{ gap: 4 }}>
            <b>✎ {t.pEditTitle}</b>
            <span className="muted small">{t.pEditIntro}</span>
          </div>
          {EDIT_GLOBAL.map(([k, l]) => {
            const v = edit[k] ?? 50;
            return (
              <div key={k}>
                <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'ed-' + k} className="small">{l[lang]}</label><span className="muted small">{v === 50 ? t.pEditSame : (v > 50 ? '+' : '') + (v - 50)}</span></div>
                <input id={'ed-' + k} type="range" min={0} max={100} value={v} onChange={e => setEdit(k, Number(e.target.value))} onDoubleClick={() => setEdit(k, 50)} />
              </div>
            );
          })}
          <span className="bold small">{t.pBody}</span>
          {BODY_PARTS.map(([k, de, en]) => {
            const v = edit.body?.[k] ?? 50;
            return (
              <div key={k}>
                <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'edb-' + k} className="small">{lang === 'de' ? de : en}</label><span className="muted small">{v === 50 ? t.pEditSame : (v > 50 ? '+' : '') + (v - 50)}</span></div>
                <input id={'edb-' + k} type="range" min={0} max={100} value={v} onChange={e => setEdit('body', { ...(edit.body || {}), [k]: Number(e.target.value) })} onDoubleClick={() => setEdit('body', { ...(edit.body || {}), [k]: 50 })} />
              </div>
            );
          })}
          {EDIT_TEXT.map(([k, l]) => {
            const v = String(edit[k] || '').trim();
            const en = v ? (p.tr?.[v] || toEn(v)) : '';
            return (
              <label key={k} className="col" style={{ gap: 4 }}><span className="muted small">{l[lang]}</span>
                {k === 'extra' ? <BigText rows={3} title={l[lang]} value={edit[k] || ''} placeholder={t.pEditExtraHint} onChange={e => setEdit(k, e.target.value)} onBlur={() => translateVal(edit[k])} />
                  : <input value={edit[k] || ''} placeholder={t.pEditFieldHint} onChange={e => setEdit(k, e.target.value)} onBlur={() => translateVal(edit[k])} />}
                {v && en && en.toLowerCase() !== v.toLowerCase() && <span className="muted small">EN: {en}</span>}
              </label>
            );
          })}
          {!useQwen && <div className="col" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="ed-strength" className="small">{t.pStrength}</label><span className="muted small">{p.editStrength ?? 55} %</span></div>
            <input id="ed-strength" type="range" min={15} max={90} value={p.editStrength ?? 55} onChange={e => set('editStrength', Number(e.target.value))} />
            <span className="muted small">{t.pRelZimage}</span>
          </div>}
          <label className="checkline small"><input type="checkbox" checked={!!p.removeBg} onChange={e => set('removeBg', e.target.checked)} /><span>{t.pRemoveBg}</span></label>
          <div className="small" style={{ background: 'rgba(127,127,127,.08)', borderRadius: 6, padding: '6px 8px' }}>{editList.length ? <><b>{t.pRelChanges}:</b> {editList.join('; ')}</> : <span className="muted">{t.pRelNone}</span>}</div>
          <div className="row wrap" style={{ gap: 6 }}>
            <button className="btn primary" disabled={!!busy || !editList.length} onClick={() => generate('edit')}>{t.pRelApply}</button>
            <button className="btn" disabled={!editList.length} onClick={() => set('edit', {})}>{t.pEditReset}</button>
          </div>
        </> : <>
        <div className="muted small">{d?.race?.name || '—'} · {d?.classInfo?.map(c => c.cls.name).join(' / ') || '—'}</div>
        <div className="col" style={{ gap: 6 }}>
          <span className="bold small">{t.pSource}</span>
          <div className="seg">
            <button className={!isFree ? 'on' : ''} onClick={() => set('promptMode', 'sliders')}>{t.pSourceSliders}</button>
            <button className={isFree ? 'on' : ''} onClick={() => set('promptMode', 'free')}>{t.pSourceFree}</button>
          </div>
        </div>
        {isFree && (
          <div className="col" style={{ gap: 6 }}>
            <BigText rows={12} value={p.freePrompt || ''} aria-label={t.pSourceFree} placeholder={t.pFreeHint} onChange={e => set('freePrompt', e.target.value)} style={{ resize: 'vertical', fontSize: 13, minHeight: 120 }} />
            <div className="row small" style={{ gap: 8 }}>
              <button className="btn sm" onClick={() => update(c => { c.designerMode = 'advisor'; return c; })}>{t.pToAdvisor}</button>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!p.freeAppendStyle} onChange={e => set('freeAppendStyle', e.target.checked)} />{t.pFreeStyle}</label>
            </div>
          </div>
        )}
        {!isFree && <>
        <div className="seg">
          {[['male', t.pMale], ['female', t.pFemale], ['nonbinary', t.pAndro]].map(([k, l]) => <button key={k} className={p.gender === k ? 'on' : ''} onClick={() => set('gender', k)}>{l}</button>)}
        </div>
        {slider('height', t.height + ' (' + (lang === 'de' ? 'typisch ' : 'typical ') + raceH + ' cm)', Math.round(raceH * 0.6), Math.round(raceH * 1.4), t.small, t.tall, ' cm', p.height || raceH)}
        {slider('build', t.build, 0, 100, t.slim, t.pFat)}
        {slider('curvy', t.pCurvy, 0, 100, t.pStraight, t.pCurvyHi)}
        {slider('muscle', t.muscle, 0, 100, t.little, t.much)}
        {slider('attract', t.pAttract, 0, 100, t.pPlain, t.pStunning)}
        {(() => { const sa = speciesAge(d?.race?.name); const a = p.age ?? 30; return (
          <div>
            <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="pt-age" className="bold small">{t.age}</label>
              <input type="number" min={5} max={1000} value={a} onChange={e => set('age', Math.max(5, Math.min(1000, Number(e.target.value) || 5)))} style={{ width: 80, padding: '2px 6px' }} aria-label={t.age} /></div>
            <input id="pt-age" type="range" min={5} max={1000} value={a} onChange={e => set('age', Number(e.target.value))} />
            <div className="muted small">{t.ageSpecies(d?.race?.name || 'Human', sa.adult, sa.max)}</div>
            {isMinorAge(d?.race?.name, a) && <div className="small" style={{ color: 'var(--accent2)' }}>{t.ageMinor}</div>}
          </div>); })()}
        <div className="col" style={{ gap: 8 }}>
          <button className="btn sm ghost" onClick={() => setShowBody(!showBody)}>{t.pBody} {showBody ? '▾' : '▸'}{Object.values(p.body || {}).some(v => v !== 50) ? ' •' : ''}</button>
          {showBody && <>
            {BODY_PARTS.map(([k, de, en]) => {
              const v = p.body?.[k] ?? 50;
              return (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'bd-' + k} className="small">{lang === 'de' ? de : en}</label><span className="muted small">{v === 50 ? t.pNormal : v}</span></div>
                  <input id={'bd-' + k} type="range" min={0} max={100} value={v} onChange={e => set('body', { ...(p.body || {}), [k]: Number(e.target.value) })} onDoubleClick={() => set('body', { ...(p.body || {}), [k]: 50 })} />
                </div>
              );
            })}
            <button className="btn sm" onClick={() => set('body', {})}>{t.pBodyReset}</button>
          </>}
        </div>
        <label className="col" style={{ gap: 4 }}><span className="muted small">{t.pPose}</span>
          <input value={p.pose || ''} placeholder={lang === 'de' ? 'z. B. kniet, zieht das Schwert, blickt über die Schulter' : 'e.g. kneeling, drawing a sword, looking over the shoulder'} onChange={e => set('pose', e.target.value)} onBlur={() => translate('pose')} />
          {p.pose && p.tr?.[String(p.pose).trim()] && <span className="muted small">EN: {p.tr[String(p.pose).trim()]}</span>}</label>
        <div className="grid g2">
          {text('hair', t.hair, lang === 'de' ? 'z. B. long black, braided' : 'e.g. long black, braided')}
          {text('eyes', t.pEyes, lang === 'de' ? 'z. B. amber' : 'e.g. amber')}
        </div>
        {text('skin', t.skin, lang === 'de' ? 'z. B. pale, tanned, bronze scales' : 'e.g. pale, tanned')}
        {text('features', t.pFeatures, lang === 'de' ? 'z. B. scar over left eye, thorn tattoos' : 'e.g. scar over left eye')}
        <label className="row small"><input type="checkbox" checked={p.useGear} onChange={e => set('useGear', e.target.checked)} />{t.pUseGear}</label>
        {text('clothing', t.pClothing, lang === 'de' ? 'z. B. long ragged leather coat' : 'e.g. long ragged leather coat')}
        </>}
        <div className="col" style={{ gap: 6 }}>
          <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
            <span className="bold small">{t.style}</span>
            <div className="seg">
              <button className={!mixMode ? 'on' : ''} onClick={() => set('styleMode', 'preset')}>{t.pStylePreset}</button>
              <button className={mixMode ? 'on' : ''} onClick={() => update(c => {
                const cur = { ...DEFAULT_PAINTER, ...(c.painter || {}) };
                // first switch: start the sliders from the current preset (or the saved slider style)
                const init = cur.mix || (cur.style === 'custom' ? savedStyles.find(x => x.id === cur.savedStyleId)?.mix : PRESET_MIX[cur.style]) || PRESET_MIX.painted;
                c.painter = { ...cur, styleMode: 'mix', mix: init };
                return c;
              })}>{t.pStyleMix}</button>
            </div>
          </div>
          {mixMode && <>
            {MIX_PARTS.map(([k, l]) => {
              const v = mix[k] ?? 0;
              return (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'mx-' + k} className="small">{l[lang]}</label><span className="muted small">{v ? v + ' %' : t.pMixOff}</span></div>
                  <input id={'mx-' + k} type="range" min={0} max={100} step={5} value={v} onChange={e => set('mix', { ...mix, [k]: Number(e.target.value) })} onDoubleClick={() => set('mix', { ...mix, [k]: 0 })} />
                </div>
              );
            })}
            {MIX_MODS.map(([k, l, ends]) => {
              const v = mix[k] ?? 50;
              return (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'mx-' + k} className="small">{l[lang]}</label><span className="muted small">{v === 50 ? t.pNormal : v < 50 ? ends[lang][0] : ends[lang][1]}</span></div>
                  <input id={'mx-' + k} type="range" min={0} max={100} step={5} value={v} onChange={e => set('mix', { ...mix, [k]: Number(e.target.value) })} onDoubleClick={() => set('mix', { ...mix, [k]: 50 })} />
                </div>
              );
            })}
            <span className="muted small">{t.pMixHint}</span>
            <div className="small" style={{ background: 'var(--panel2, rgba(127,127,127,.08))', borderRadius: 6, padding: '6px 8px', wordBreak: 'break-word' }}><span className="muted">{t.pMixPreview}: </span>{mixStyleText(mix) || <span className="muted">{t.pMixEmpty}</span>}</div>
            <BigText rows={2} value={p.mixNegative || ''} aria-label={t.pNegative} placeholder={qTurbo ? t.pNegativeTurbo : t.pNegativeHint} onChange={e => set('mixNegative', e.target.value)} />
            <div className="row wrap" style={{ gap: 6 }}>
              <button className="btn sm" onClick={() => set('mix', {})}>{t.pMixReset}</button>
              {curMixSaved && (!sameMix(curMixSaved.mix, mix) || (curMixSaved.negative || '') !== (p.mixNegative || '')) && <button className="btn sm" onClick={() => saveSettings({ ...globalSettings, customStyles: savedStyles.map(y => (y.id === curMixSaved.id ? { ...y, mix: { ...mix }, text: mixStyleText(mix), negative: p.mixNegative || '' } : y)) })}>{t.pStyleUpdate(curMixSaved.name)}</button>}
              <button className="btn sm" disabled={!mixStyleText(mix)} onClick={async () => {
                const name = await promptDialog(t.pStyleName, curMixSaved ? curMixSaved.name + ' 2' : '');
                if (!name) return;
                const id = 's' + Date.now().toString(36);
                saveSettings({ ...globalSettings, customStyles: [...savedStyles, { id, name, text: mixStyleText(mix), negative: p.mixNegative || '', mix: { ...mix } }] });
                set('mixSavedId', id);
              }}>{t.pMixSave}</button>
            </div>
            {savedStyles.some(x => x.mix) && <div className="row wrap" style={{ gap: 6 }}>
              <span className="muted small">{t.pMixLoad}:</span>
              {savedStyles.filter(x => x.mix).map(x => <button key={x.id} className={'chip' + (p.mixSavedId === x.id ? ' on' : '')} onClick={() => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), mix: { ...x.mix }, mixNegative: x.negative || '', mixSavedId: x.id }; return c; })}>★ {x.name}</button>)}
            </div>}
          </>}
          {!mixMode && <>
          <div className="row wrap" style={{ gap: 6 }}>
            {STYLES.filter(x => x[0] !== 'custom').map(([k, l]) => <button key={k} className={'chip' + (p.style === k ? ' on' : '')} onClick={() => set('style', k)}>{l[lang]}</button>)}
            {savedStyles.map(x => (
              <span key={x.id} className={'chip' + (p.style === 'custom' && p.savedStyleId === x.id ? ' on' : '')} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
                onClick={() => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), style: 'custom', customStyle: x.text, customNegative: x.negative || '', savedStyleId: x.id, ...(x.mix ? { mix: { ...x.mix }, mixSavedId: x.id } : {}) }; return c; })} title={x.text}>
                {x.mix ? '🎚' : '★'} {x.name}
                <span role="button" aria-label={t.delete} style={{ opacity: .6 }} onClick={async e => { e.stopPropagation(); if (await confirmDialog(t.pStyleDelete(x.name))) saveSettings({ ...globalSettings, customStyles: savedStyles.filter(y => y.id !== x.id) }); }}>×</span>
              </span>
            ))}
            <button className={'chip' + (p.style === 'custom' && !p.savedStyleId ? ' on' : '')} onClick={() => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), style: 'custom', savedStyleId: null }; return c; })}>+ {STYLES.find(x => x[0] === 'custom')[1][lang]}</button>
          </div>
          {p.style === 'custom' && <>
            <BigText rows={3} value={p.customStyle || ''} aria-label={t.pCustomStyle} placeholder={t.pCustomStyleHint} onChange={e => set('customStyle', e.target.value)} />
            <BigText rows={2} value={p.customNegative || ''} aria-label={t.pNegative} placeholder={qTurbo ? t.pNegativeTurbo : t.pNegativeHint} onChange={e => set('customNegative', e.target.value)} />
            <div className="row" style={{ gap: 6 }}>
              {curSaved && (curSaved.text !== (p.customStyle || '') || (curSaved.negative || '') !== (p.customNegative || '')) && <button className="btn sm" onClick={() => saveSettings({ ...globalSettings, customStyles: savedStyles.map(y => (y.id === curSaved.id ? { ...y, text: p.customStyle || '', negative: p.customNegative || '' } : y)) })}>{t.pStyleUpdate(curSaved.name)}</button>}
              <button className="btn sm" disabled={!(p.customStyle || '').trim()} onClick={async () => {
                const name = await promptDialog(t.pStyleName, curSaved ? curSaved.name + ' 2' : '');
                if (!name) return;
                const id = 's' + Date.now().toString(36);
                saveSettings({ ...globalSettings, customStyles: [...savedStyles, { id, name, text: p.customStyle || '', negative: p.customNegative || '' }] });
                set('savedStyleId', id);
              }}>{t.pStyleSave}</button>
            </div>
          </>}
          </>}
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="bold small">{t.pFraming}</span>
          <div className="seg">{FRAMINGS.map(([k, l]) => <button key={k} className={p.framing === k ? 'on' : ''} onClick={() => set('framing', k)}>{l[lang]}</button>)}</div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="bold small">{t.pRes} <span className="muted">· {(upscaleSize(p) || frameSize(p)).width} × {(upscaleSize(p) || frameSize(p)).height} px{upscaleSize(p) ? ' (' + t.pUpscaled + ')' : ''}</span></span>
          <div className="row wrap" style={{ gap: 6 }}>{RESOLUTIONS.map(([k, l]) => <button key={k} className={'chip' + ((p.res || 'std') === k ? ' on' : '')} onClick={() => set('res', k)}>{l[lang]}</button>)}</div>
          <span className="muted small">{t.pResHint}</span>
        </div>
        {useQwen && !qTurbo && (
          <div className="col" style={{ gap: 6 }}>
            <span className="bold small">{t.pSteps}</span>
            <div className="row wrap" style={{ gap: 6 }}>{[[20, t.pStepsFast], [30, t.pStepsStd], [45, t.pStepsBest]].map(([n, l]) => <button key={n} className={'chip' + ((p.qSteps || 30) === n ? ' on' : '')} onClick={() => set('qSteps', n)}>{l} · {n}</button>)}</div>
            <span className="muted small">{t.pStepsHint}</span>
          </div>
        )}
        <label className="checkline small" title={t.pSfwHint}><input type="checkbox" checked={p.sfwLock !== false} onChange={e => set('sfwLock', e.target.checked)} /><span>{t.pSfw}</span></label>
        <label className="checkline small"><input type="checkbox" checked={p.removeBg} onChange={e => set('removeBg', e.target.checked)} /><span>{t.pRemoveBg}</span></label>
        {useQwen && p.removeBg && <label className="checkline small sub" title={t.pQwenAlphaHint}><input type="checkbox" checked={p.qwenAlpha !== false} onChange={e => set('qwenAlpha', e.target.checked)} /><span>{t.pQwenAlpha}</span></label>}
        <label className="col" style={{ gap: 4 }}><span className="muted small">{t.pExtra}</span>
          <BigText rows={2} title={t.pExtra} value={p.extra || ''} onChange={e => set('extra', e.target.value)} onBlur={() => translate('extra')} />{p.extra && p.tr?.[String(p.extra).trim()] && <span className="muted small">EN: {p.tr[String(p.extra).trim()]}</span>}</label>
        <button className="btn sm ghost" onClick={() => setShowPrompt(!showPrompt)}>{t.pPrompt} {showPrompt ? '▾' : '▸'}</button>
        {showPrompt && (
          <div className="col" style={{ gap: 6 }}>
            <BigText rows={7} value={prompt} onChange={e => set('promptOverride', e.target.value)} aria-label={t.pPrompt} style={{ fontSize: 12, resize: 'vertical' }} />
            {p.promptOverride != null && <button className="btn sm" onClick={() => set('promptOverride', null)}>{t.pPromptReset}</button>}
          </div>
        )}
        </>}
      </section>

      <section className="col" style={{ flex: '999 1 460px', minWidth: 0 }}>
        {st && !ready && (
          <div className="card col">
            <h3 style={{ margin: 0 }}>{t.aiSetupTitle}</h3>
            {st.supported ? <AiSetup compact onDone={refresh} /> : <div className="banner info" style={{ margin: 0 }}>{t.aiWinOnly}</div>}
          </div>
        )}
        {ready && (
          <div className="card row" style={{ padding: 12 }}>
            <span className="dot" style={{ background: st.running ? 'var(--ok)' : st.starting ? 'var(--accent)' : 'var(--dim)' }} />
            <span className="small">{st.running ? t.aiRunning : st.starting ? t.aiStarting : t.aiStopped}</span>
            <div className="grow" />
            {editOn && selImg ? <>
              <button className="btn primary" disabled={!!busy || !editList.length} onClick={() => generate('edit')}>{t.pRelApply}</button>
              <button className="btn" disabled={!!busy} onClick={() => setEditOn(false)}>{t.pEditBack}</button>
            </> : <>
              <button className="btn primary" disabled={!!busy} onClick={() => generate('new')}>{t.pGenerate}</button>
              <button className="btn" disabled={!!busy || !selImg} onClick={() => generate('refine')} title={t.pRefineHint}>{t.pRefine}</button>
              <button className="btn" disabled={!!busy} onClick={() => generate('multi')} title={t.pMultiHint}>{t.pMulti}</button>
              <button className="btn" disabled={!!busy || !selImg} onClick={() => { update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), edit: {} }; return c; }); setEditOn(true); }} title={t.pEditOpenHint}>✎ {t.pEditOpen}</button>
            </>}
          </div>
        )}
        {ready && !(editOn && selImg) && (
          <div className="row small wrap" style={{ gap: 10, padding: '0 4px' }}>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={p.multiFromSel !== false} disabled={!selImg || selMeta?.kind === 'multi'} onChange={e => set('multiFromSel', e.target.checked)} />{t.pMultiFromSel}</label>
            {!useQwen && p.multiFromSel !== false && selImg && selMeta?.kind !== 'multi' && <>
              <label htmlFor="pt-mstrength" className="muted">{t.pMultiStrength}</label>
              <input id="pt-mstrength" type="range" min={40} max={95} value={p.multiStrength ?? 78} onChange={e => set('multiStrength', Number(e.target.value))} style={{ maxWidth: 160 }} />
              <span className="muted">{p.multiStrength ?? 78} %</span>
            </>}
          </div>
        )}
        {ready && (!hasQwen || !hasQwenTurbo) && (
          <div className="row small wrap" style={{ gap: 10, padding: '0 4px' }}>
            <span className="muted grow">{t.pQwenHint}</span>
            {!hasQwenTurbo && <button className="btn sm" disabled={!!bgInstall} onClick={() => installModel('qwen-image-21-turbo')}>{bgInstall ? t.aiDownloading + ' ' + bgInstall : (hasQwen ? t.pQwenTurboLoadShared : t.pQwenTurboLoad)}</button>}
            {!hasQwen && <button className="btn sm" disabled={!!bgInstall} onClick={() => installModel('qwen-image-21')}>{bgInstall ? t.aiDownloading + ' ' + bgInstall : (hasQwenTurbo ? t.pQwenLoadShared : t.pQwenLoad)}</button>}
          </div>
        )}
        {ready && useQwen && selImg && !editOn && (
          <label className="col small" style={{ gap: 4, padding: '0 4px' }}><span className="muted">{t.pEditText}</span>
            <input value={p.editText || ''} placeholder={t.pEditTextHint} onChange={e => set('editText', e.target.value)} /></label>
        )}
        {ready && selImg && !useQwen && !editOn && (
          <div className="row small" style={{ gap: 10, padding: '0 4px' }}>
            <label htmlFor="pt-strength" className="muted">{t.pStrength}</label>
            <input id="pt-strength" type="range" min={15} max={90} value={p.strength} onChange={e => set('strength', Number(e.target.value))} style={{ maxWidth: 240 }} />
            <span className="muted">{p.strength} % – {p.strength < 40 ? t.pSmall : p.strength < 65 ? t.pMedium : t.pBig}</span>
          </div>
        )}
        {ramWarn && (
          <div className="banner" style={{ margin: 0 }}>
            <span className="small grow">{t.pRamLow(ramWarn.freeGB.toFixed(1), Math.round(ramWarn.totalGB))}{ramWarn.strata ? ' ' + t.pRamStrata : ''}</span>
            {ramWarn.strata && <button className="btn sm primary" onClick={async () => { const lc = globalSettings?.llm || {}; await api.strata.stop({ cmd: lc.cmd, force: true }); setTimeout(() => generate(ramWarn.mode), 4000); setRamWarn(null); }}>{t.pRamStopStrata}</button>}
            <button className="btn sm" onClick={() => generate(ramWarn.mode, true)}>{t.pRamAnyway}</button>
            <button className="btn sm ghost" onClick={() => setRamWarn(null)}>{t.cancel}</button>
          </div>
        )}
        {ready && !isFree && p.promptOverride != null && <div className="banner" style={{ margin: 0 }}><span className="small grow">{t.pOverrideWarn}</span><button className="btn sm" onClick={() => set('promptOverride', null)}>{t.pPromptReset}</button></div>}
        {ready && upscaleSize(p) && !hasUpscale && (
          <div className="banner" style={{ margin: 0 }}>
            <span className="small grow">{t.pUpModel}</span>
            <button className="btn sm primary" disabled={!!bgInstall} onClick={() => installModel('upscale')}>{bgInstall ? t.aiDownloading + ' ' + bgInstall : t.pUpModelBtn}</button>
          </div>
        )}
        {ready && p.removeBg && !hasBiRef && (
          <div className="banner" style={{ margin: 0 }}>
            <span className="small grow">{t.pBgModel}</span>
            <button className="btn sm primary" disabled={!!bgInstall} onClick={async () => {
              setBgInstall('…'); setErr(null);
              const off = api.ai.on('ai:progress', pr => setBgInstall((pr.pct ?? 0) + ' %'));
              try { await api.ai.install({ dir: st.dir, gpu: st.gpu, models: ['birefnet'], comfy: false }); } catch (e) { setErr(String(e.message || e)); }
              off(); setBgInstall(null); refresh();
            }}>{bgInstall ? t.aiDownloading + ' ' + bgInstall : t.pBgModelBtn}</button>
          </div>
        )}
        {busy && <div className="banner info" style={{ margin: 0, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div className="row" style={{ gap: 10 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /><span className="grow">{busy.cancelling ? t.pCancelling : (st?.running ? t.pPainting : t.aiStartingFirst)} · {fmtTime(busy.seconds)}{busy.charId !== ch.id ? ' · ' + (busy.name || '') : ''}</span>
          <button className="btn sm" disabled={busy.cancelling} onClick={() => cancelJob('paint')}>{t.cancel}</button></div>
          {!busy.cancelling && <div className="col" style={{ gap: 4 }}>
            <div className={'progbar' + (jobPct(busy) == null ? ' indet' : '')}><i style={{ width: (jobPct(busy) ?? 30) + '%' }} /></div>
            <span className="muted small">{busy.stage === 'sample' ? t.progStep(busy.step, busy.total) + (busy.eta != null ? ' · ' + t.progEta(fmtTime(busy.eta)) : '') + ' · ' + jobPct(busy) + ' %'
              : busy.stage === 'post' ? t.progPost : t.progLoading}</span>
          </div>}
        </div>}
        {!err && !busy && lastDone?.kind === 'paint' && !lastDone.ok && lastDone.msg && lastDone.msg !== 'CANCELLED' && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small" style={{ whiteSpace: 'pre-wrap' }}>{lastDone.msg === 'COMFY_TOO_OLD' ? t.pComfyOld : lastDone.msg}</span></div>}
        {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small grow" style={{ whiteSpace: 'pre-wrap' }}>{err === 'COMFY_TOO_OLD' ? t.pComfyOld : err}</span>
          {err === 'COMFY_TOO_OLD' && <button className="btn sm primary" disabled={!!bgInstall} onClick={async () => { setBgInstall('…'); const off = api.ai.on('ai:progress', pr => setBgInstall((pr.pct ?? 0) + ' %')); try { await api.ai.install({ dir: st.dir, gpu: st.gpu, models: [], comfy: true }); setErr(null); } catch (e) { setErr(String(e.message || e)); } off(); setBgInstall(null); refresh(); }}>{bgInstall ? t.aiDownloading + ' ' + bgInstall : t.pComfyUpdate}</button>}</div>}
        <div className="col" style={{ gap: 6 }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importImage(e.dataTransfer.files?.[0]); }}>
          <ZoomView src={selImg} empty={t.pEmptyImport} labels={{ fit: t.zoomFit, hint: t.zoomHint, open: t.zoomOpen }} onOpen={() => setBig(true)} />
          {big && <ImageModal src={selImg} onClose={() => setBig(false)} labels={{ fit: t.zoomFit, hint: t.zoomHint, close: t.close }} />}
        </div>
        <div className="row small" style={{ gap: 8 }}>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => { importImage(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn sm" onClick={() => fileRef.current?.click()}>{t.pImport}</button>
          <span className="muted">{t.pImportHint}</span>
        </div>
        {paintings.length > 0 && (
          <div className="row" style={{ gap: 8, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
            {paintings.map(pt => (
              <button key={pt.name} className="checker" onClick={() => update(c => { c.selectedPainting = pt.name; return c; })}
                style={{ position: 'relative', flex: 'none', width: 74, height: 100, borderRadius: 8, border: '2px solid ' + (pt.name === selName ? 'var(--accent)' : 'var(--line)'), padding: 0, overflow: 'hidden' }} aria-label={'#' + pt.seed}>
                {cache[pt.name] && <img src={cache[pt.name]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                {pt.kind && <span className="badge" style={{ position: 'absolute', left: 3, top: 3 }}>{pt.kind === 'multi' ? '4×' : pt.kind === 'edit' ? '✎' : '⇪'}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="col" style={{ flex: '1 1 220px', maxWidth: 260 }}>
        {/* token generator removed for now (to be redone later) */}
        <div className="card col">
          <span className="bold">{t.export}</span>
          <button className="btn primary" disabled={!selImg} onClick={exportPng}>{t.exportPng}</button>
          {selMeta?.kind === 'multi' && <button className="btn" onClick={exportViews} title={t.pViewsHint}>{t.pViews}</button>}
          <button className="btn ghost" disabled={!selImg} onClick={usePortrait}>{lang === 'de' ? 'Als Portrait übernehmen' : 'Use as portrait'}</button>
          {selImg && <button className="btn sm danger" onClick={() => update(c => { api.deleteImage(c.id, selName); c.paintings = (c.paintings || []).filter(x => x.name !== selName); c.selectedPainting = c.paintings[0]?.name; return c; })}>{t.delete}</button>}
        </div>
      </aside>
      {showSetup && null}
    </div>
  );
}
