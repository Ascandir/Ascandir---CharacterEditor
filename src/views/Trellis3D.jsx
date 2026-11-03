import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { splitViews, padSquare } from '../ai/images.js';
import { useJob, finishJob, cancelJob, fmtTime } from '../ai/jobs.js';

const VIEW_KEYS = ['front', 'right', 'back', 'left'];

function Viewer({ data, t }) {
  const mount = useRef(null);
  const three = useRef(null);
  useEffect(() => {
    const el = mount.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(2, 4, 3); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 0.2, 2.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const grid = new THREE.GridHelper(2, 10, 0x444a55, 0x2a2e36); grid.position.y = -0.5; scene.add(grid);
    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    three.current = { scene, camera, controls, grid, model: null };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);
  useEffect(() => {
    const T = three.current; if (!T) return;
    if (T.model) { T.scene.remove(T.model); T.model = null; }
    if (!data) return;
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    new GLTFLoader().parse(buf, '', g => {
      const m = g.scene;
      const box = new THREE.Box3().setFromObject(m); const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
      const s = 1 / Math.max(size.x, size.y, size.z);
      m.scale.setScalar(s); m.position.set(-c.x * s, -c.y * s, -c.z * s);
      T.grid.position.y = -size.y * s / 2;
      T.scene.add(m); T.model = m;
      T.controls.target.set(0, 0, 0); T.camera.position.set(0, 0.15, 2.2);
    }, e => console.error(e));
  }, [data]);
  return <div ref={mount} className="checker" style={{ flex: 'none', height: 'max(300px, calc(100vh - 230px))', borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden', position: 'relative' }}>
    {!data && <span className="muted" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>{t.t3Empty}</span>}
  </div>;
}

export default function Trellis3D({ ch, update }) {
  const { t } = useT();
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useJob('model3d');
  const [lastLog, setLastLog] = useState('');
  const [thumbs, setThumbs] = useState({});
  const [views, setViews] = useState(null);
  const [glb, setGlb] = useState(null);
  const [inst, setInst] = useState(null);
  const [quant, setQuant] = useState('f16');
  const [upd, setUpd] = useState(null);
  const s3 = { source: null, view: 'front', resolution: 1024, texture: true, seed: 42, model3d: 'trellis', normalMap: true, detail: 'auto', ...(ch.trellis || {}) };
  const set = (k, v) => update(c => { c.trellis = { ...s3, ...(c.trellis || {}), [k]: v }; return c; });
  const paintings = ch.paintings || [];
  const models = ch.models3d || [];
  // default source: newest multi-angle sheet, otherwise the selected painting
  const srcName = (s3.source && paintings.find(p => p.name === s3.source)) ? s3.source : (paintings.find(p => p.kind === 'multi')?.name || ch.selectedPainting || paintings[0]?.name);
  const srcMeta = paintings.find(p => p.name === srcName);
  const selModel = ch.selectedModel3d || models[0]?.name;

  const refresh = () => api.trellis.status().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => {
    refresh();
    const o1 = api.trellis.on('trellis:log', l => setLastLog(l));
    const o2 = () => {};
    const o3 = api.trellis.on('trellis:state', refresh);
    const o4 = api.ai.on('ai:progress', pr => setInst(x => (x && pr.phase !== 'done' ? { label: pr.label || x.label, pct: pr.pct, speed: pr.speed } : x)));
    api.trellis.updates?.().then(setUpd).catch(() => {});
    return () => { o1(); o2(); o3(); o4(); };
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => { for (const p of paintings) { if (thumbs[p.name]) continue; try { const u = await api.loadImage(ch.id, p.name); if (alive && u) setThumbs(x => ({ ...x, [p.name]: u })); } catch { /* gone */ } } })();
    return () => { alive = false; };
  }, [paintings.map(p => p.name).join(), ch.id]);
  useEffect(() => {
    setViews(null);
    if (srcMeta?.kind === 'multi' && thumbs[srcName]) splitViews(thumbs[srcName]).then(setViews);
  }, [srcName, thumbs[srcName]]);
  useEffect(() => {
    setGlb(null);
    if (selModel) api.trellis.load({ charId: ch.id, name: selModel }).then(d => d && setGlb(new Uint8Array(d))).catch(e => setErr(String(e.message || e)));
  }, [selModel, ch.id]);

  const inputImage = srcMeta?.kind === 'multi' ? views?.[Math.max(0, VIEW_KEYS.indexOf(s3.view))] : thumbs[srcName];

  const generate = async () => {
    if (busy) return;
    const jobChar = ch.id; let ok = false; let failMsg = null;
    setErr(null); setBusy({ seconds: 0, charId: jobChar, name: ch.name });
    try {
      const image = srcMeta?.kind === 'multi' ? inputImage : await padSquare(inputImage);
      const usePixal = s3.model3d === 'pixal3d' && st?.pixalOk;
      const r = await api.trellis.generate({ charId: jobChar, image, seed: s3.seed, resolution: s3.resolution, texture: s3.texture, model: usePixal ? 'pixal3d' : 'trellis', normalMap: s3.normalMap !== false, faces: s3.detail === 'auto' ? null : s3.detail });
      ok = true;
      const add = (c) => { c.models3d = [{ name: r.name, ts: Date.now(), seed: s3.seed, resolution: s3.resolution, model: usePixal ? 'pixal3d' : 'trellis', source: srcName, view: srcMeta?.kind === 'multi' ? s3.view : null, seconds: r.seconds, size: r.size }, ...(c.models3d || [])]; c.selectedModel3d = r.name; return c; };
      update(c => { if (c.id === jobChar) return add(c); api.loadChar(jobChar).then(o => { if (o) api.saveChar(add(o)); }).catch(() => {}); return c; });
    } catch (e) { const m = String(e.message || e); if (!/CANCELLED/.test(m)) { setErr(m); failMsg = m; } else failMsg = 'CANCELLED'; }
    finishJob('model3d', ok, failMsg); refresh();
  };
  const fname = (ch.name || 'character').replace(/[^\w-]+/g, '_');

  if (st && !st.supported) return <div className="page"><div className="card banner info">{t.aiWinOnly}</div></div>;
  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <section className="card col" style={{ flex: '1 1 300px', maxWidth: 380, gap: 12 }}>
        <span className="bold">TRELLIS.2</span>
        {st && (!st.installed || !st.own || inst || upd?.update) && (
          <div className="col" style={{ gap: 8 }}>
            {!st.installed && <span className="small">{t.t3NotFound}</span>}
            {st.installed && !st.own && <span className="muted small">{t.t3UsingStudio}</span>}
            {upd?.update && <span className="small" style={{ color: 'var(--accent2)' }}>{t.t3UpdateAvail(upd.latest)}</span>}
            {!inst && <>
              {!upd?.update && <>
                <span className="muted small">{t.t3Weights}</span>
                <div className="seg">{Object.entries(st.quants || { f16: { gb: 16.5 }, q8: { gb: 9.5 }, q4: { gb: 6 } }).map(([k, q]) => <button key={k} className={quant === k ? 'on' : ''} onClick={() => setQuant(k)}>{k.toUpperCase()} · {q.gb} GB</button>)}</div>
                <span className="muted small">{t.t3QuantHint}</span>
              </>}
              <button className={'btn' + (!st.installed || upd?.update ? ' primary' : '')} onClick={async () => {
                setErr(null); setInst({ label: '…', pct: 0 });
                try { await api.trellis.setup({ quant, runtimeOnly: !!upd?.update }); setUpd(null); } catch (e) { if (!/cancel/.test(String(e))) setErr(String(e.message || e)); }
                setInst(null); refresh();
              }}>{upd?.update ? t.t3Update : t.t3InstallOwn}</button>
            </>}
            {inst && (
              <div className="col" style={{ gap: 6 }}>
                <span className="small">{inst.label} · {inst.pct ?? 0} %{inst.speed ? ` · ${(inst.speed / 1e6).toFixed(1)} MB/s` : ''}</span>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--line)' }}><div style={{ width: (inst.pct || 0) + '%', height: 8, borderRadius: 4, background: 'var(--accent)' }} /></div>
                <span className="muted small">{t.t3InstallResume}</span>
                <button className="btn sm" onClick={() => api.trellis.cancel()}>{t.cancel}</button>
              </div>
            )}
          </div>
        )}
        {st?.installed && (
          <>
            <div className="row small" style={{ gap: 8 }}>
              <span className="dot" style={{ background: st.running ? 'var(--ok)' : st.starting ? 'var(--accent)' : 'var(--dim)' }} />
              <span className="grow">{st.running ? (st.external ? t.t3RunningExt : t.aiRunning) : st.starting ? t.aiStarting : t.aiStopped} · {st.cfg?.backend || ''}</span>
              {!st.running && <button className="btn sm" disabled={!!busy} onClick={() => { setErr(null); api.trellis.start().catch(e => setErr(String(e.message || e))).finally(refresh); setTimeout(refresh, 300); }}>{t.aiStart}</button>}
              {st.running && !st.external && !busy && <button className="btn sm" onClick={() => api.trellis.stop().then(() => setTimeout(refresh, 800))}>{t.aiStop}</button>}
            </div>
            {!st.modelsOk && <div className="banner" style={{ margin: 0 }}><span className="small">{t.t3NoModels}</span></div>}
          </>
        )}
        <span className="bold small">{t.t3Source}</span>
        {paintings.length === 0 && <span className="muted small">{t.t3NoImages}</span>}
        <div className="row" style={{ gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 4 }}>
          {paintings.map(p => (
            <button key={p.name} className="checker" onClick={() => set('source', p.name)} aria-label={p.name}
              style={{ position: 'relative', flex: 'none', width: p.kind === 'multi' ? 112 : 56, height: 76, borderRadius: 8, padding: 0, overflow: 'hidden', border: '2px solid ' + (p.name === srcName ? 'var(--accent)' : 'var(--line)') }}>
              {thumbs[p.name] && <img src={thumbs[p.name]} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              {p.kind === 'multi' && <span className="badge" style={{ position: 'absolute', left: 3, top: 3 }}>4×</span>}
            </button>
          ))}
        </div>
        {srcMeta?.kind === 'multi' && (
          <>
            <span className="muted small">{t.t3ViewHint}</span>
            <div className="row" style={{ gap: 6 }}>
              {VIEW_KEYS.map((k, i) => (
                <button key={k} className="checker" onClick={() => set('view', k)} title={t['t3' + k]}
                  style={{ width: 64, height: 64, padding: 0, borderRadius: 8, overflow: 'hidden', border: '2px solid ' + (s3.view === k ? 'var(--accent)' : 'var(--line)') }}>
                  {views?.[i] && <img src={views[i]} alt={t['t3' + k]} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                </button>
              ))}
            </div>
          </>
        )}
        {srcMeta && srcMeta.kind !== 'multi' && <span className="muted small">{t.t3NotMulti}</span>}
        <span className="bold small">{t.t3Model}</span>
        <div className="seg">
          <button className={s3.model3d !== 'pixal3d' ? 'on' : ''} onClick={() => set('model3d', 'trellis')}>TRELLIS.2</button>
          <button className={s3.model3d === 'pixal3d' ? 'on' : ''} onClick={() => set('model3d', 'pixal3d')}>Pixal3D</button>
        </div>
        <span className="muted small">{s3.model3d === 'pixal3d' ? t.t3PixalHint : t.t3TrellisHint}</span>
        {s3.model3d === 'pixal3d' && st?.installed && !st.pixalOk && !inst && (
          <button className="btn sm primary" onClick={async () => {
            setErr(null); setInst({ label: '…', pct: 0 });
            try { await api.trellis.installPixal(); } catch (e) { if (!/cancel/.test(String(e))) setErr(String(e.message || e)); }
            setInst(null); refresh(); api.trellis.updates?.().then(setUpd).catch(() => {});
          }}>{t.t3PixalLoad}</button>
        )}
        {inst && st?.installed && s3.model3d === 'pixal3d' && !st.pixalOk && (
          <div className="col" style={{ gap: 6 }}>
            <span className="small">{inst.label} · {inst.pct ?? 0} %{inst.speed ? ` · ${(inst.speed / 1e6).toFixed(1)} MB/s` : ''}</span>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--line)' }}><div style={{ width: (inst.pct || 0) + '%', height: 8, borderRadius: 4, background: 'var(--accent)' }} /></div>
            <button className="btn sm" onClick={() => api.trellis.cancel()}>{t.cancel}</button>
          </div>
        )}
        {s3.model3d === 'pixal3d' && st?.installed && !st.own && st.pixalOk && <span className="muted small">{t.t3PixalStudio}</span>}
        <span className="bold small">{t.t3Quality}</span>
        <div className="seg">{[512, 1024, 1536].map(r => <button key={r} className={s3.resolution === r ? 'on' : ''} onClick={() => set('resolution', r)}>{r}</button>)}</div>
        <span className="muted small">{t.t3QualityHint}</span>
        {s3.model3d === 'pixal3d' && s3.resolution === 512 && <span className="muted small">{t.t3Pixal512}</span>}
        <span className="bold small">{t.t3Detail}</span>
        <div className="seg">{[['auto', t.t3DetailStd], [600000, t.t3DetailHigh], [1500000, t.t3DetailMax]].map(([k, l]) => <button key={k} className={String(s3.detail) === String(k) ? 'on' : ''} onClick={() => set('detail', k)}>{l}</button>)}</div>
        <span className="muted small">{t.t3DetailHint}</span>
        <label className="checkline small"><input type="checkbox" checked={s3.normalMap !== false} onChange={e => set('normalMap', e.target.checked)} /><span>{t.t3Normal}<br /><span className="muted">{t.t3NormalHint}</span></span></label>
        <label className="row small"><input type="checkbox" checked={s3.texture} onChange={e => set('texture', e.target.checked)} />{t.t3Texture}</label>
        <label className="row small" style={{ gap: 6 }}>Seed <input type="number" value={s3.seed} onChange={e => set('seed', Number(e.target.value) || 0)} style={{ width: 110 }} />
          <button className="btn sm" onClick={() => set('seed', Math.floor(Math.random() * 1e6))}>🎲</button></label>
        <button className="btn primary" disabled={!!busy || !st?.installed || !inputImage} onClick={generate}>{t.t3Generate}</button>
        {busy && <div className="banner info" style={{ margin: 0 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /><span className="small grow">{t.t3Busy} · {fmtTime(busy.seconds)}<br /><span className="muted">{lastLog.slice(0, 90)}</span></span>
          <button className="btn sm" disabled={busy.cancelling} onClick={() => cancelJob('model3d')}>{t.cancel}</button></div>}
        {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small" style={{ whiteSpace: 'pre-wrap' }}>{err}</span></div>}
      </section>

      <section className="col" style={{ flex: '999 1 460px', minWidth: 0 }}>
        <Viewer data={glb} t={t} />
        {models.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {models.map((m, i) => (
              <button key={m.name} className={'chip' + (m.name === selModel ? ' on' : '')} onClick={() => update(c => { c.selectedModel3d = m.name; return c; })}>
                #{models.length - i} · {m.model === 'pixal3d' ? 'Pixal3D · ' : ''}{m.resolution}{m.view ? ' · ' + t['t3' + m.view] : ''} · {new Date(m.ts).toLocaleTimeString()}
              </button>
            ))}
          </div>
        )}
      </section>

      <aside className="col" style={{ flex: '1 1 240px', maxWidth: 300 }}>
        <div className="card col">
          <span className="bold">{t.export}</span>
          <button className="btn primary" disabled={!selModel} onClick={() => api.trellis.exportGlb({ charId: ch.id, name: selModel, defaultName: fname + '.glb' })}>{t.t3ExportGlb}</button>
          <button className="btn ghost" onClick={() => api.trellis.openDir(ch.id)}>{t.t3OpenDir}</button>
          {selModel && <button className="btn sm danger" onClick={() => update(c => { api.trellis.remove({ charId: c.id, name: selModel }); c.models3d = (c.models3d || []).filter(x => x.name !== selModel); c.selectedModel3d = c.models3d[0]?.name; return c; })}>{t.delete}</button>}
          <span className="muted small">{t.t3ViewerHint}</span>
        </div>
      </aside>
    </div>
  );
}
