import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { useT } from '../i18n.js';
import { api } from '../platform.js';
import { buildFigure } from '../three/figure.js';
import { RINGS, composeToken } from '../three/token.js';

const STYLES = [['realistic', { de: 'Realistisch', en: 'Realistic' }], ['painted', { de: 'Gemalt', en: 'Painted' }], ['comic', { de: 'Comic', en: 'Comic' }], ['miniature', { de: 'Miniatur', en: 'Miniature' }]];
const OPTS = {
  head: [['human', 'Mensch / Human'], ['elf', 'Spitze Ohren / Pointed ears'], ['dragon', 'Drachenkopf / Dragon'], ['horns', 'Hörner / Horns'], ['orc', 'Hauer / Tusks'], ['beast', 'Tierohren / Beast ears']],
  hairStyle: [['none', '—'], ['short', 'Kurz / Short'], ['long', 'Lang / Long'], ['bun', 'Dutt / Bun'], ['beard', 'Bart / Beard']],
  armor: [['none', '—'], ['robe', 'Robe'], ['leather', 'Leder / Leather'], ['chain', 'Kette / Chain'], ['plate', 'Platte / Plate']],
  weapon: [['none', '—'], ['sword', 'Schwert / Sword'], ['axe', 'Axt / Axe'], ['staff', 'Stab / Staff'], ['bow', 'Bogen / Bow'], ['dagger', 'Dolch / Dagger']],
};

function toBase64(buf) {
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
}

export default function Designer({ ch, update, createChar }) {
  const { t, lang } = useT();
  const mount = useRef(null);
  const tokenCanvas = useRef(null);
  const tokRef = useRef({});
  const three = useRef(null);
  const [mode, setMode] = useState('kit');
  const a = ch ? { tokenRing: 'gold', tokenColor: '#E3A74B', tokenBg: '#2a2e36', tokenZoom: 15, tokenTransparent: false, height: 180, build: 45, muscle: 50, age: 30, skin: '#c99a76', hairStyle: 'short', hairColor: '#3b2a1e', head: 'human', armor: 'leather', weapon: 'sword', style: 'painted', primary: '#7a2e2e', ...(ch.appearance || {}) } : null;

  useEffect(() => {
    if (!mount.current) return;
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    camera.position.set(1.2, 1.3, 4.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.95, 0); controls.enablePan = false; controls.minDistance = 1.5; controls.maxDistance = 9; controls.update();
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x2a2622, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(0x9cc6f2, 1.0); rim.position.set(-3, 2, -3); scene.add(rim);
    const resize = () => {
      const w = el.clientWidth; const h = el.clientHeight;
      renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    // token view: own camera that follows the main view's rotation, framed on the head
    const TS = 512;
    const tokenRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    tokenRenderer.setPixelRatio(1); tokenRenderer.setSize(TS, TS, false); tokenRenderer.setClearColor(0x000000, 0);
    tokenRenderer.outputColorSpace = THREE.SRGBColorSpace;
    const tokenCam = new THREE.PerspectiveCamera(30, 1, 0.02, 50);
    const dir = new THREE.Vector3(); const tgt = new THREE.Vector3();
    const placeTokenCam = () => {
      const fig = three.current?.figure; if (!fig) return;
      const H = fig.userData.height; const z = (tokRef.current.tokenZoom ?? 15) / 100;
      tgt.set(0, (fig.userData.headY - 0.02 * H) * (1 - z) + 0.5 * H * z, 0);
      dir.copy(camera.position).sub(controls.target).normalize();
      tokenCam.position.copy(tgt).addScaledVector(dir, 0.55 * H + (3.4 * H - 0.55 * H) * z);
      tokenCam.lookAt(tgt);
    };
    const drawToken = (ctx, size) => {
      placeTokenCam();
      tokenRenderer.render(scene, tokenCam);
      const tk = tokRef.current;
      composeToken(ctx, size, tokenRenderer.domElement, { ring: tk.tokenRing, color: tk.tokenColor, bg: tk.tokenBg, transparentBg: tk.tokenTransparent });
    };
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop); controls.update(); renderer.render(scene, camera);
      const tc = tokenCanvas.current; if (tc) drawToken(tc.getContext('2d'), tc.width);
    };
    loop();
    three.current = { renderer, scene, camera, controls, figure: null, drawToken };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); tokenRenderer.dispose(); el.removeChild(renderer.domElement); three.current = null; };
  }, [!!ch]);

  // rebuild figure live on every change (style switch keeps all parameters)
  useEffect(() => {
    const T = three.current; if (!T || !a) return;
    if (T.figure) { T.scene.remove(T.figure); T.figure.traverse(o => { o.geometry?.dispose?.(); }); }
    T.figure = buildFigure(a); T.scene.add(T.figure);
    T.controls.target.set(0, T.figure.userData.height * 0.52, 0); T.controls.update();
  }, [JSON.stringify(a)]);

  tokRef.current = a || {};
  if (!ch) return <div className="loading"><button className="btn primary" onClick={createChar}>{t.newChar}</button></div>;
  const set = (k, v) => update(c => { c.appearance = { ...c.appearance, [k]: v }; return c; });

  const renderAt = (w, h) => {
    const T = three.current; const r = T.renderer;
    const oldSize = new THREE.Vector2(); r.getSize(oldSize); const pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(w, h, false); T.camera.aspect = w / h; T.camera.updateProjectionMatrix();
    r.render(T.scene, T.camera);
    const url = r.domElement.toDataURL('image/png');
    r.setPixelRatio(pr); r.setSize(oldSize.x, oldSize.y, false); T.camera.aspect = oldSize.x / oldSize.y; T.camera.updateProjectionMatrix();
    return url;
  };
  const savePortrait = () => { const url = renderAt(300, 400); update(c => { c.portrait = url; return c; }); return url; };
  const fname = (ch.name || 'character').replace(/[^\w-]+/g, '_');
  const exportPng = async () => {
    const url = renderAt(1200, 1600); savePortrait();
    await api.saveFile({ defaultName: fname + '.png', filters: [{ name: 'PNG', extensions: ['png'] }], dataBase64: url.split(',')[1] });
  };
  const exportToken = async () => {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    three.current.drawToken(c.getContext('2d'), 1024);
    await api.saveFile({ defaultName: fname + '-token.png', filters: [{ name: 'PNG', extensions: ['png'] }], dataBase64: c.toDataURL('image/png').split(',')[1] });
  };
  const exportGlb = async () => {
    const T = three.current;
    const glb = await new GLTFExporter().parseAsync(T.figure, { binary: true });
    await api.saveFile({ defaultName: fname + '.glb', filters: [{ name: 'GLB', extensions: ['glb'] }], dataBase64: toBase64(glb) });
  };

  const slider = ({ k, label, min, max, unit, lo, hi }) => (
    <div>
      <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor={'sl-' + k} className="bold">{label}</label><span className="muted">{a[k]}{unit}</span></div>
      <input id={'sl-' + k} type="range" min={min} max={max} value={a[k]} onChange={e => set(k, Number(e.target.value))} />
      <div className="row muted small" style={{ justifyContent: 'space-between' }}><span>{lo}</span><span>{hi}</span></div>
    </div>
  );
  const sel = ({ k, label }) => (
    <label className="col" style={{ gap: 4 }}><span className="muted small">{label}</span>
      <select value={a[k]} onChange={e => set(k, e.target.value)}>{OPTS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
  );
  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <section className="card col" style={{ flex: '1 1 300px', maxWidth: 360 }}>
        <div className="seg">
          <button className={mode === 'kit' ? 'on' : ''} onClick={() => setMode('kit')}>{t.designerKit}</button>
          <button className={mode === 'ai' ? 'on' : ''} onClick={() => setMode('ai')}>{t.designerAi}</button>
        </div>
        {mode === 'ai' && <div className="banner info" style={{ margin: 0 }}>{t.aiTextSoon}</div>}
        {mode === 'kit' && (
          <>
            {slider({k: "height", label: t.height, min: 90, max: 250, unit: " cm", lo: t.small, hi: t.tall,})}
            {slider({k: "build", label: t.build, min: 0, max: 100, unit: " %", lo: t.slim, hi: t.heavy,})}
            {slider({k: "muscle", label: t.muscle, min: 0, max: 100, unit: " %", lo: t.little, hi: t.much,})}
            {slider({k: "age", label: t.age, min: 12, max: 95, unit: "", lo: t.young, hi: t.old,})}
            <div className="grid g2">
              {sel({k: "head", label: t.head,})}
              {sel({k: "hairStyle", label: t.hair,})}
              {sel({k: "armor", label: t.armor,})}
              {sel({k: "weapon", label: t.weapon,})}
            </div>
            <div className="row">
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!a.helmet} onChange={e => set('helmet', e.target.checked)} />{t.helmet}</label>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!a.shield} onChange={e => set('shield', e.target.checked)} />{t.shield}</label>
              <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={!!a.cape} onChange={e => set('cape', e.target.checked)} />{t.cape}</label>
            </div>
            <div className="row">
              <label className="row" style={{ gap: 6 }}><input type="color" value={a.skin} onChange={e => set('skin', e.target.value)} aria-label={t.skin} style={{ width: 44, height: 34, padding: 2 }} />{t.skin}</label>
              <label className="row" style={{ gap: 6 }}><input type="color" value={a.hairColor} onChange={e => set('hairColor', e.target.value)} aria-label={t.hairColor} style={{ width: 44, height: 34, padding: 2 }} />{t.hairColor}</label>
              <label className="row" style={{ gap: 6 }}><input type="color" value={a.primary} onChange={e => set('primary', e.target.value)} aria-label="Farbe" style={{ width: 44, height: 34, padding: 2 }} />{lang === 'de' ? 'Kleidung' : 'Clothes'}</label>
            </div>
          </>
        )}
        <div className="col" style={{ gap: 8 }}>
          <span className="bold">{t.style}</span>
          <div className="row" style={{ gap: 6 }}>
            {STYLES.map(([k, l]) => <button key={k} className={'chip' + (a.style === k ? ' on' : '')} onClick={() => set('style', k)}>{l[lang]}</button>)}
          </div>
          <span className="muted small">{t.styleNote}</span>
        </div>
      </section>

      <section className="checker" style={{ flex: '999 1 460px', minWidth: 0, minHeight: 620, borderRadius: 14, border: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
        <div ref={mount} style={{ position: 'absolute', inset: 0 }} />
        <div className="pill" style={{ position: 'absolute', left: 14, top: 14, background: 'rgba(18,20,24,.85)' }}>{t.dragRotate}</div>
      </section>

      <aside className="col" style={{ flex: '1 1 280px', maxWidth: 320 }}>
        <div className="card col">
          <span className="bold">Token</span>
          <div className="checker" style={{ borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'center' }}>
            <canvas ref={tokenCanvas} width={560} height={560} style={{ width: 260, height: 260 }} aria-label="Token" />
          </div>
          <span className="muted small">{t.tokenFollows}</span>
          <div>
            <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="tk-zoom" className="bold small">{t.tokenFrame}</label></div>
            <input id="tk-zoom" type="range" min={0} max={100} value={a.tokenZoom} onChange={e => set('tokenZoom', Number(e.target.value))} />
            <div className="row muted small" style={{ justifyContent: 'space-between' }}><span>{t.tokenHead}</span><span>{t.tokenBody}</span></div>
          </div>
          <span className="bold small">{t.tokenRing}</span>
          <div className="row" style={{ gap: 6 }}>
            {RINGS.map(([k, l]) => <button key={k} className={'chip' + (a.tokenRing === k ? ' on' : '')} onClick={() => set('tokenRing', k)}>{l[lang]}</button>)}
          </div>
          <div className="row">
            <label className="row small" style={{ gap: 6 }}><input type="color" value={a.tokenColor} onChange={e => set('tokenColor', e.target.value)} aria-label={t.tokenRingColor} style={{ width: 40, height: 30, padding: 2 }} />{t.tokenRingColor}</label>
            <label className="row small" style={{ gap: 6 }}><input type="color" value={a.tokenBg} onChange={e => set('tokenBg', e.target.value)} aria-label={t.tokenBgColor} style={{ width: 40, height: 30, padding: 2 }} disabled={a.tokenTransparent} />{t.tokenBgColor}</label>
          </div>
          <label className="row small"><input type="checkbox" checked={!!a.tokenTransparent} onChange={e => set('tokenTransparent', e.target.checked)} />{t.tokenTransparent}</label>
        </div>
        <div className="card col">
          <span className="bold">{t.export}</span>
          <button className="btn primary" onClick={exportPng}>{t.exportPng}</button>
          <button className="btn" onClick={exportToken}>{t.exportToken}</button>
          <button className="btn" onClick={exportGlb}>{t.exportGlb}</button>
          <button className="btn ghost" onClick={savePortrait}>{lang === 'de' ? 'Als Portrait übernehmen' : 'Use as portrait'}</button>
        </div>
      </aside>
    </div>
  );
}
