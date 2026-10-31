import React, { useEffect, useMemo, useRef, useState } from 'react';
import ZoomView from '../components/ZoomView.jsx';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { buildPrompt, frameSize, removeBackground, STYLES, FRAMINGS, DEFAULT_PAINTER, typicalHeight, MULTI_SIZE, BODY_PARTS } from '../ai/prompt.js';
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

// split a sheet into its views, each trimmed to its content and padded to a square (good input for TRELLIS)
async function splitViews(dataUrl, views = MULTI_SIZE.views) {
  const img = await toImg(dataUrl); const W = img.naturalWidth, H = img.naturalHeight; const slot = Math.floor(W / views);
  const out = [];
  for (let i = 0; i < views; i++) {
    const c = document.createElement('canvas'); c.width = slot; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, -slot * i, 0);
    const px = x.getImageData(0, 0, slot, H).data;
    let x0 = slot, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let k = 0; k < slot; k++) if (px[(y * slot + k) * 4 + 3] > 24) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = slot - 1; y1 = H - 1; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.round(Math.max(bw, bh) * 1.1);
    const o = document.createElement('canvas'); o.width = o.height = side;
    o.getContext('2d').drawImage(c, x0, y0, bw, bh, Math.round((side - bw) / 2), Math.round((side - bh) / 2), bw, bh);
    out.push(o.toDataURL('image/png'));
  }
  return out;
}

export default function Painter({ ch, d, update }) {
  const { t, lang } = useT();
  const p = { ...DEFAULT_PAINTER, ...(ch.painter || {}), crop: { ...DEFAULT_PAINTER.crop, ...(ch.painter?.crop || {}) } };
  const tk = { tokenRing: 'gold', tokenColor: '#E3A74B', tokenBg: '#2a2e36', tokenTransparent: false, ...(ch.appearance || {}) };
  const set = (k, v) => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), [k]: v }; return c; });
  const setTk = (k, v) => update(c => { c.appearance = { ...(c.appearance || {}), [k]: v }; return c; });
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(null); // {mode, seconds}
  const [err, setErr] = useState(null);
  const [cache, setCache] = useState({});
  const [count, setCount] = useState(2);
  const [showSetup, setShowSetup] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const tokenRef = useRef(null);
  const paintings = ch.paintings || [];
  const selName = ch.selectedPainting || paintings[0]?.name;
  const selImg = cache[selName];
  const raceH = typicalHeight(d?.race?.name);
  const autoPrompt = useMemo(() => buildPrompt(d, ch, p), [d, ch.inventory, JSON.stringify(p)]);
  const prompt = p.promptOverride ?? autoPrompt;
  const multiPrompt = useMemo(() => buildPrompt(d, ch, p, { multi: true }), [d, ch.inventory, JSON.stringify(p)]);
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
      const all = [{ name, seed: 0, prompt: '', ts: Date.now(), kind: 'import', file: file.name }, ...(x.paintings || [])];
      for (const old of all.slice(MAX_PAINTINGS)) api.deleteImage(x.id, old.name);
      x.paintings = all.slice(0, MAX_PAINTINGS); x.selectedPainting = name; return x;
    });
  };

  const refresh = () => api.ai.status().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => { refresh(); const off1 = api.ai.on('ai:gen', g => setBusy(b => (b ? { ...b, seconds: g.seconds } : b))); const off2 = api.ai.on('ai:state', refresh); return () => { off1(); off2(); }; }, []);
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
  const [bgInstall, setBgInstall] = useState(null);

  const generate = async (mode) => {
    setErr(null); setBusy({ mode, seconds: 0 });
    try {
      const multi = mode === 'multi';
      const { width, height } = multi ? MULTI_SIZE : frameSize(p);
      const seed = Math.floor(Math.random() * 2 ** 31);
      const usedPrompt = multi ? multiPrompt : prompt;
      const params = { prompt: usedPrompt, seed, width, height, batch: multi ? 1 : mode === 'refine' ? Math.min(count, 2) : count, removeBg: (multi || p.removeBg) && hasBiRef };
      if (mode === 'refine' && selImg) { params.initImage = await onGrey(selImg); params.denoise = Math.max(0.15, Math.min(0.9, p.strength / 100)); }
      if (multi && selImg && p.multiFromSel !== false && selMeta?.kind !== 'multi') { params.initImage = await multiInit(await onGrey(selImg)); params.denoise = Math.max(0.4, Math.min(0.95, (p.multiStrength ?? 78) / 100)); }
      const res = await api.ai.generate(params);
      const saved = [];
      for (const [i, raw] of res.images.entries()) {
        const url = (multi || p.removeBg) && !hasBiRef ? await removeBackground(raw) : raw;
        const name = await api.saveImage(ch.id, url);
        setCache(c => ({ ...c, [name]: url }));
        saved.push({ name, seed: seed + i, prompt: usedPrompt, ts: Date.now(), seconds: res.seconds, ...(multi ? { kind: 'multi' } : {}) });
      }
      update(c => {
        const all = [...saved, ...(c.paintings || [])];
        for (const old of all.slice(MAX_PAINTINGS)) api.deleteImage(c.id, old.name);
        c.paintings = all.slice(0, MAX_PAINTINGS); c.selectedPainting = saved[0]?.name; return c;
      });
    } catch (e) { setErr(String(e.message || e)); }
    setBusy(null); refresh();
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
  const text = (k, label, ph) => (
    <label key={k} className="col" style={{ gap: 4 }}><span className="muted small">{label}</span>
      <input value={p[k] || ''} placeholder={ph} onChange={e => set(k, e.target.value)} /></label>
  );

  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <section className="card col" style={{ flex: '1 1 300px', maxWidth: 360, gap: 12 }}>
        <div className="muted small">{d?.race?.name || '—'} · {d?.classInfo?.map(c => c.cls.name).join(' / ') || '—'}</div>
        <div className="seg">
          {[['male', t.pMale], ['female', t.pFemale], ['nonbinary', t.pAndro]].map(([k, l]) => <button key={k} className={p.gender === k ? 'on' : ''} onClick={() => set('gender', k)}>{l}</button>)}
        </div>
        {slider('height', t.height + ' (' + (lang === 'de' ? 'typisch ' : 'typical ') + raceH + ' cm)', Math.round(raceH * 0.6), Math.round(raceH * 1.4), t.small, t.tall, ' cm', p.height || raceH)}
        {slider('build', t.build, 0, 100, t.slim, t.pFat)}
        {slider('curvy', t.pCurvy, 0, 100, t.pStraight, t.pCurvyHi)}
        {slider('muscle', t.muscle, 0, 100, t.little, t.much)}
        {slider('attract', t.pAttract, 0, 100, t.pPlain, t.pStunning)}
        {slider('age', t.age, 18, 100, t.young, t.old)}
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
          <input value={p.pose || ''} placeholder={lang === 'de' ? 'z. B. kniet, zieht das Schwert, blickt über die Schulter' : 'e.g. kneeling, drawing a sword, looking over the shoulder'} onChange={e => set('pose', e.target.value)} /></label>
        <div className="grid g2">
          {text('hair', t.hair, lang === 'de' ? 'z. B. long black, braided' : 'e.g. long black, braided')}
          {text('eyes', t.pEyes, lang === 'de' ? 'z. B. amber' : 'e.g. amber')}
        </div>
        {text('skin', t.skin, lang === 'de' ? 'z. B. pale, tanned, bronze scales' : 'e.g. pale, tanned')}
        {text('features', t.pFeatures, lang === 'de' ? 'z. B. scar over left eye, thorn tattoos' : 'e.g. scar over left eye')}
        <label className="row small"><input type="checkbox" checked={p.useGear} onChange={e => set('useGear', e.target.checked)} />{t.pUseGear}</label>
        {text('clothing', t.pClothing, lang === 'de' ? 'z. B. long ragged leather coat' : 'e.g. long ragged leather coat')}
        <div className="col" style={{ gap: 6 }}>
          <span className="bold small">{t.style}</span>
          <div className="row" style={{ gap: 6 }}>{STYLES.map(([k, l]) => <button key={k} className={'chip' + (p.style === k ? ' on' : '')} onClick={() => set('style', k)}>{l[lang]}</button>)}</div>
          {p.style === 'custom' && <textarea rows={3} value={p.customStyle || ''} aria-label={t.pCustomStyle} placeholder={t.pCustomStyleHint} onChange={e => set('customStyle', e.target.value)} />}
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="bold small">{t.pFraming}</span>
          <div className="seg">{FRAMINGS.map(([k, l]) => <button key={k} className={p.framing === k ? 'on' : ''} onClick={() => set('framing', k)}>{l[lang]}</button>)}</div>
        </div>
        <label className="row small"><input type="checkbox" checked={p.removeBg} onChange={e => set('removeBg', e.target.checked)} />{t.pRemoveBg}</label>
        <label className="col" style={{ gap: 4 }}><span className="muted small">{t.pExtra}</span>
          <textarea rows={2} value={p.extra || ''} onChange={e => set('extra', e.target.value)} /></label>
        <button className="btn sm ghost" onClick={() => setShowPrompt(!showPrompt)}>{t.pPrompt} {showPrompt ? '▾' : '▸'}</button>
        {showPrompt && (
          <div className="col" style={{ gap: 6 }}>
            <textarea rows={7} value={prompt} onChange={e => set('promptOverride', e.target.value)} aria-label={t.pPrompt} style={{ fontSize: 12 }} />
            {p.promptOverride != null && <button className="btn sm" onClick={() => set('promptOverride', null)}>{t.pPromptReset}</button>}
          </div>
        )}
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
            <label className="row small" style={{ gap: 6 }}>{t.pCount}
              <select value={count} onChange={e => setCount(Number(e.target.value))}>{[1, 2, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
            <button className="btn primary" disabled={!!busy} onClick={() => generate('new')}>{t.pGenerate}</button>
            <button className="btn" disabled={!!busy || !selImg} onClick={() => generate('refine')} title={t.pRefineHint}>{t.pRefine}</button>
            <button className="btn" disabled={!!busy} onClick={() => generate('multi')} title={t.pMultiHint}>{t.pMulti}</button>
          </div>
        )}
        {ready && (
          <div className="row small wrap" style={{ gap: 10, padding: '0 4px' }}>
            <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={p.multiFromSel !== false} disabled={!selImg || selMeta?.kind === 'multi'} onChange={e => set('multiFromSel', e.target.checked)} />{t.pMultiFromSel}</label>
            {p.multiFromSel !== false && selImg && selMeta?.kind !== 'multi' && <>
              <label htmlFor="pt-mstrength" className="muted">{t.pMultiStrength}</label>
              <input id="pt-mstrength" type="range" min={40} max={95} value={p.multiStrength ?? 78} onChange={e => set('multiStrength', Number(e.target.value))} style={{ maxWidth: 160 }} />
              <span className="muted">{p.multiStrength ?? 78} %</span>
            </>}
          </div>
        )}
        {ready && selImg && (
          <div className="row small" style={{ gap: 10, padding: '0 4px' }}>
            <label htmlFor="pt-strength" className="muted">{t.pStrength}</label>
            <input id="pt-strength" type="range" min={15} max={90} value={p.strength} onChange={e => set('strength', Number(e.target.value))} style={{ maxWidth: 240 }} />
            <span className="muted">{p.strength} % – {p.strength < 40 ? t.pSmall : p.strength < 65 ? t.pMedium : t.pBig}</span>
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
        {busy && <div className="banner info" style={{ margin: 0 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />{st?.running ? t.pPainting : t.aiStartingFirst} · {busy.seconds || 0} s</div>}
        {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small" style={{ whiteSpace: 'pre-wrap' }}>{err}</span></div>}
        <div className="col" style={{ flex: 1, gap: 6 }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importImage(e.dataTransfer.files?.[0]); }}>
          <ZoomView src={selImg} empty={t.pEmptyImport} labels={{ fit: t.zoomFit, hint: t.zoomHint }} />
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
                {pt.kind && <span className="badge" style={{ position: 'absolute', left: 3, top: 3 }}>{pt.kind === 'multi' ? '4×' : '⇪'}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="col" style={{ flex: '1 1 280px', maxWidth: 320 }}>
        <div className="card col">
          <span className="bold">Token</span>
          <div className="checker" style={{ borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'center' }}>
            <canvas ref={tokenRef} width={560} height={560} style={{ width: 240, height: 240 }} aria-label="Token" />
          </div>
          {[['size', t.pCropSize, 10, 100], ['x', t.pCropX, 0, 100], ['y', t.pCropY, 0, 100]].map(([k, l, mn, mx]) => (
            <div key={k}>
              <label htmlFor={'cr-' + k} className="muted small">{l}</label>
              <input id={'cr-' + k} type="range" min={mn} max={mx} value={p.crop[k]} onChange={e => set('crop', { ...p.crop, [k]: Number(e.target.value) })} />
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>{RINGS.map(([k, l]) => <button key={k} className={'chip' + (tk.tokenRing === k ? ' on' : '')} onClick={() => setTk('tokenRing', k)}>{l[lang]}</button>)}</div>
          <div className="row">
            <label className="row small" style={{ gap: 6 }}><input type="color" value={tk.tokenColor} onChange={e => setTk('tokenColor', e.target.value)} aria-label={t.tokenRingColor} style={{ width: 40, height: 30, padding: 2 }} />{t.tokenRingColor}</label>
            <label className="row small" style={{ gap: 6 }}><input type="color" value={tk.tokenBg} onChange={e => setTk('tokenBg', e.target.value)} aria-label={t.tokenBgColor} style={{ width: 40, height: 30, padding: 2 }} />{t.tokenBgColor}</label>
          </div>
          <label className="row small"><input type="checkbox" checked={!!tk.tokenTransparent} onChange={e => setTk('tokenTransparent', e.target.checked)} />{t.tokenTransparent}</label>
        </div>
        <div className="card col">
          <span className="bold">{t.export}</span>
          <button className="btn primary" disabled={!selImg} onClick={exportPng}>{t.exportPng}</button>
          <button className="btn" disabled={!selImg} onClick={exportToken}>{t.exportToken}</button>
          {selMeta?.kind === 'multi' && <button className="btn" onClick={exportViews} title={t.pViewsHint}>{t.pViews}</button>}
          <button className="btn ghost" disabled={!selImg} onClick={usePortrait}>{lang === 'de' ? 'Als Portrait übernehmen' : 'Use as portrait'}</button>
          {selImg && <button className="btn sm danger" onClick={() => update(c => { api.deleteImage(c.id, selName); c.paintings = (c.paintings || []).filter(x => x.name !== selName); c.selectedPainting = c.paintings[0]?.name; return c; })}>{t.delete}</button>}
        </div>
      </aside>
      {showSetup && null}
    </div>
  );
}
