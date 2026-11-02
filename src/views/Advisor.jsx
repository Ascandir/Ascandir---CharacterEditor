import React, { useEffect, useRef, useState } from 'react';
import BigText from '../components/BigText.jsx';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { DEFAULT_PAINTER, STYLES, BODY_PARTS, styleOf } from '../ai/prompt.js';
import Markdown from '../components/Markdown.jsx';

const DEFAULT_URL = 'http://127.0.0.1:8080/v1';

const MODEL_INFO = {
  zimage: { name: 'Z-Image Turbo', tips: 'Z-Image Turbo (6B, 8 steps). It does NOT understand negative prompts: describe only what should be visible (say "photorealistic" instead of "not anime"). It weighs the beginning of the prompt most, so put the art style and the most important features (species anatomy, body shape, outfit) first. Keep the prompt at 80-150 words; it loses details in very long prompts. It does not know uncommon D&D creatures by name, so always describe their anatomy.' },
  qwenturbo: { name: 'Qwen Image 2.1 Turbo', tips: 'Qwen Image 2.1 Turbo (20B, 8 steps). It follows long, detailed natural-language descriptions very precisely (up to about 250 words), including exact colors, counts and positions. Negative prompts have no effect in turbo mode, so describe only what should be visible.' },
  qwen: { name: 'Qwen Image 2.1', tips: 'Qwen Image 2.1 (20B). It follows long, detailed natural-language descriptions very precisely (up to about 250 words), including exact colors, counts and positions. If useful, add a second fenced block starting with ```negative listing things to avoid (it is used with CFG).' },
};

function systemPrompt(lang, model, style, transparent, mode = 'sliders', bodyKeys = []) {
  const m = MODEL_INFO[model] || MODEL_INFO.zimage;
  return `You are an expert prompt designer for AI character art of Dungeons & Dragons characters.
Talk with the user in ${lang === 'de' ? 'German' : 'English'}. Find out how their character should look: species anatomy, face, hair, body shape, age, clothing, armor, weapons, pose, mood, ${style ? '' : 'art style, '}lighting, framing.
Ask at most 2-3 short questions at a time and make concrete suggestions. Use the character sheet facts you are given.
Whenever you have enough information, or the user asks for it, ${mode === 'sliders' ? 'fill in the character designer of the app (see SETTINGS below).' : 'write the final image prompt.'}
${mode === 'sliders' ? `SETTINGS: output one fenced code block that starts with \`\`\`settings and contains only JSON with these keys (leave out keys you do not know):
{"gender":"male|female|nonbinary","age":number (years),"height":number (cm),"build":0-100 (0 very thin, 50 average, 100 very fat),"curvy":0-100,"muscle":0-100,"attract":0-100 (0 grotesquely ugly, 55 average, 100 stunning),
"hair":"English hair description","skin":"English skin/scale/fur colour","eyes":"English eye description","features":"English (scars, tattoos, horns, jewellery ...)","clothing":"English outfit and armor","pose":"English pose","extra":"English extra details",
"body":{${bodyKeys.map(k => '"' + k + '":0-100').join(',')}} (50 = normal, only include parts that differ),
"framing":"full|three|portrait"}
All text values in English. Then explain in 2-3 short sentences (in the user's language) what you set, so the user can fine-tune the sliders.
The following rules about prompts only apply to the English text fields.` : ''}
Target image model: ${m.name}. ${m.tips}
Rules for the image prompt:
- ${mode === 'sliders' ? 'Write the text fields in English.' : 'Always in English, inside a fenced code block that starts with \`\`\`prompt and ends with \`\`\`.'}
- Natural descriptive language in flowing sentences (no keyword soup, no weights like (word:1.2)).
- ${style ? `Art style (fixed by the user, do not change it, describe the picture in exactly this style and mention it at the start and the end of the prompt): "${style}".` : 'Suggest an art style that fits and include it at the start of the prompt.'}
- Then the framing (e.g. "full body shot"), species and anatomy, body, face, hair, clothing and gear, pose, lighting.
- ${transparent ? 'The app removes the background itself: describe a plain empty background (no scenery).' : 'Describe a fitting background.'}
- Non-human species must be described anatomically and explicitly (e.g. an aarakocra has a full eagle head, feathers all over the body, wings on the back, bird legs with talons; it is not a human with feathers).
- Fully clothed, safe for work.
After the prompt, offer one or two optional variations in a single short sentence.`;
}

function sheetFacts(ch, d) {
  const eq = (ch.inventory || []).filter(i => i.equipped).map(i => i.name);
  const p = ch.painter || {};
  return [
    `Name: ${ch.name || '-'}`,
    `Species: ${d?.race?.name || '-'}`,
    `Class: ${(d?.classInfo || []).map(c => c.cls.name + ' ' + c.level).join(' / ') || '-'}`,
    `Background: ${d?.background?.name || '-'}`,
    `Gender (from the painter): ${p.gender || '-'}`,
    eq.length ? `Equipped: ${eq.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}

export function extractBlocks(text) {
  const out = { prompt: null, negative: null, settings: null };
  const re = /```(\w*)\s*\n([\s\S]*?)```/g; let m;
  while ((m = re.exec(text || ''))) {
    const tag = m[1].toLowerCase();
    if (tag === 'settings' || tag === 'json') { try { out.settings = JSON.parse(m[2]); } catch { /* not valid json */ } continue; }
    if (tag === 'negative') out.negative = m[2].trim();
    else if (!out.prompt || tag === 'prompt') out.prompt = m[2].trim();
  }
  return out;
}

export default function Advisor({ ch, d, update, globalSettings, saveSettings }) {
  const { t, lang } = useT();
  const cfg = { url: DEFAULT_URL, key: '', reasoning: 'low', autoStart: true, preset: '', idle: 10, stopBeforePaint: true, cmd: '', ...(globalSettings?.llm || {}) };
  const setCfg = (k, v) => saveSettings({ ...globalSettings, llm: { ...cfg, [k]: v } });
  const [sInfo, setSInfo] = useState(null);
  const [sPresets, setSPresets] = useState(null);
  const [sProg, setSProg] = useState(null);
  const loadStrata = async () => {
    const i = await api.strata.info({ cmd: cfg.cmd, url: cfg.url, key: cfg.key }).catch(() => null); setSInfo(i);
    if (i?.cmd) { const ps = await api.strata.presets({ cmd: cfg.cmd }).catch(() => []); setSPresets(ps); if (!cfg.preset && ps[0]) setCfg('preset', ps[0].name); }
  };
  useEffect(() => { loadStrata(); }, [cfg.cmd]);
  useEffect(() => { api.strata.setIdle(cfg.idle || 0, { cmd: cfg.cmd }); }, [cfg.idle, cfg.cmd]);
  useEffect(() => {
    const o1 = api.strata.on('strata:progress', p => setSProg(p));
    const o2 = api.strata.on('strata:state', () => { loadStrata(); check(); });
    return () => { o1(); o2(); };
  }, []);
  const canAuto = !!(sInfo?.cmd && cfg.autoStart && cfg.preset);
  const startStrata = async () => {
    setErr(null); setSProg({ seconds: 0, line: '' });
    try { const r = await api.strata.start({ cmd: cfg.cmd, preset: cfg.preset, url: cfg.url, key: cfg.key }); if (r?.url) setCfg('url', r.url); await check(); }
    catch (e) { const m = String(e.message || e); if (/CANCELLED/.test(m)) { setSProg(null); return; } setErr(/STRATA_NOT_FOUND/.test(m) ? t.advStrataMissing : /STRATA_NO_PRESET/.test(m) ? t.advStrataNoPreset : m); }
    setSProg(null);
  };
  const msgs = ch.advisor?.messages || [];
  const [input, setInput] = useState('');
  const [conn, setConn] = useState(null); // null | {ok, model, err}
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(null); // {text, think}
  const [err, setErr] = useState(null);
  const [withSheet, setWithSheet] = useState(true);
  const [withImage, setWithImage] = useState(false);
  const [showCfg, setShowCfg] = useState(false);
  const curModel = ['qwen', 'qwenturbo'].includes(ch.painter?.model) ? ch.painter.model : 'zimage';
  const savedStyles = globalSettings?.customStyles || [];
  const advStyle = ch.advisor?.style ?? 'painter';
  const pp = { ...DEFAULT_PAINTER, ...(ch.painter || {}) };
  const painterStyleText = styleOf(pp).text;
  const styleText = advStyle === 'free' ? '' : advStyle === 'painter' ? painterStyleText
    : advStyle.startsWith('saved:') ? (savedStyles.find(x => 'saved:' + x.id === advStyle)?.text || '') : ((STYLES.find(x => x[0] === advStyle) || [])[2] || '');
  const advMode = ch.advisor?.mode || 'sliders';
  const setAdv = (k, v) => update(c => { c.advisor = { ...(c.advisor || {}), [k]: v }; return c; });
  const listRef = useRef(null);
  // the advisor fills exactly the free height of the window (chat in between scrolls, input stays visible)
  const boxRef = useRef(null);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    const fit = () => {
      const el = boxRef.current; if (!el) return;
      let sc = el.parentElement; while (sc && sc !== document.body && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      const top = el.getBoundingClientRect().top + (sc && sc !== document.body ? sc.scrollTop : window.scrollY);
      const bottom = sc && sc !== document.body ? sc.getBoundingClientRect().top : 0;
      setBoxH(Math.max(420, Math.floor(window.innerHeight - (top - bottom) - bottom - 24)));
    };
    fit(); const t2 = setTimeout(fit, 50);
    window.addEventListener('resize', fit);
    return () => { clearTimeout(t2); window.removeEventListener('resize', fit); };
  }, []);
  const reqId = useRef(0);

  const check = async () => {
    setConn(null);
    try { const m = await api.llm.models({ url: cfg.url, key: cfg.key }); const c = { ok: true, model: m[0] || 'local' }; setConn(c); return c; } catch (e) { setConn({ ok: false, err: String(e.message || e) }); return null; }
  };
  useEffect(() => { check(); }, [cfg.url, cfg.key]);
  useEffect(() => api.llm.on('llm:chunk', c => { if (c.id === reqId.current) setLive(l => ({ ...(l || {}), ...(c.text != null ? { text: c.text } : {}), ...(c.think != null ? { think: c.think } : {}) })); }), []);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [msgs.length, live?.text]);

  const setMsgs = (fn) => update(c => { c.advisor = { ...(c.advisor || {}), messages: fn(c.advisor?.messages || []) }; return c; });

  const send = async () => {
    const text = input.trim(); if (!text || busy) return;
    setErr(null); setInput('');
    const userMsg = { role: 'user', content: text };
    let image = null;
    if (withImage && ch.selectedPainting) { try { image = await api.loadImage(ch.id, ch.selectedPainting); } catch { /* none */ } }
    const history = [...msgs, userMsg];
    setMsgs(() => history);
    const system = systemPrompt(lang, curModel, styleText, !!ch.painter?.removeBg, advMode, BODY_PARTS.map(b => b[0])) + (withSheet ? '\n\nCharacter sheet:\n' + sheetFacts(ch, d) : '');
    const apiMsgs = [{ role: 'system', content: system }, ...history.map((m, i) => (i === history.length - 1 && image
      ? { role: m.role, content: [{ type: 'text', text: m.content }, { type: 'image_url', image_url: { url: image } }] }
      : { role: m.role, content: m.content }))];
    const id = ++reqId.current;
    setBusy(true); setLive({ text: '', think: '' });
    try {
      let c = conn?.ok ? conn : await check();
      if (!c && canAuto) { setSProg({ seconds: 0, line: '' }); await api.strata.start({ cmd: cfg.cmd, preset: cfg.preset, url: cfg.url, key: cfg.key }); setSProg(null); c = await check(); }
      if (!c) throw new Error('NO_SERVER');
      const r = await api.llm.chat({ url: cfg.url, key: cfg.key, model: c.model, messages: apiMsgs, reasoning: cfg.reasoning, id });
      if (r.text) setMsgs(m => [...m, { role: 'assistant', content: r.text }]);
    } catch (e) {
      const m = String(e.message || e);
      setErr(/NO_SERVER/.test(m) ? t.advNoServer : /STRATA_NOT_FOUND/.test(m) ? t.advStrataMissing : /STRATA_NO_PRESET/.test(m) ? t.advStrataNoPreset : m);
    }
    setBusy(false); setLive(null); setSProg(null);
  };

  const applySettings = (st) => update(c => {
    const cur = { ...DEFAULT_PAINTER, ...(c.painter || {}) };
    const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : undefined);
    const nx = { ...cur, promptMode: 'sliders', promptOverride: null };
    if (['male', 'female', 'nonbinary'].includes(st.gender)) nx.gender = st.gender;
    for (const [k, lo, hi] of [['age', 5, 1000], ['height', 30, 400], ['build', 0, 100], ['curvy', 0, 100], ['muscle', 0, 100], ['attract', 0, 100]]) { const v = num(st[k], lo, hi); if (v != null) nx[k] = v; }
    for (const k of ['hair', 'skin', 'eyes', 'features', 'clothing', 'pose', 'extra']) if (typeof st[k] === 'string') nx[k] = st[k];
    if (['full', 'three', 'portrait'].includes(st.framing)) nx.framing = st.framing;
    if (st.body && typeof st.body === 'object') {
      const body = {}; for (const [k] of BODY_PARTS) { const v = num(st.body[k], 0, 100); if (v != null) body[k] = v; }
      nx.body = body;
    }
    c.painter = nx; c.designerMode = 'painter'; return c;
  });
  const takeOver = (block) => update(c => {
    c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), promptMode: 'free', freePrompt: block.prompt, ...(block.negative ? { customNegative: block.negative } : {}) };
    c.designerMode = 'painter'; return c;
  });

  const renderMsg = (m, i) => {
    const blocks = m.role === 'assistant' ? extractBlocks(m.content) : {};
    return (
      <div key={i} className={'chatmsg ' + m.role}>
        <div className="chatbubble"><Markdown text={m.content} /></div>
        {blocks.settings && (
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn sm primary" onClick={() => applySettings(blocks.settings)}>{t.advApply}</button>
          </div>
        )}
        {blocks.prompt && (
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <button className="btn sm primary" onClick={() => takeOver(blocks)}>{t.advTake}</button>
            <button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(blocks.prompt)}>{t.advCopy}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page" style={{ alignItems: 'stretch' }}>
      <section ref={boxRef} className="card col" style={{ flex: '999 1 600px', minWidth: 0, gap: 10, height: boxH || undefined, overflowY: 'auto' }}>
        <div className="row small" style={{ gap: 8 }}>
          <span className="dot" style={{ background: conn?.ok ? 'var(--ok)' : conn ? 'var(--bad)' : 'var(--dim)' }} />
          <span className="grow">{conn?.ok ? t.advConnected(conn.model) : conn ? t.advNotConnected : '…'}</span>
          <label className="row" style={{ gap: 6 }}>{t.advThink}
            <select value={cfg.reasoning} onChange={e => setCfg('reasoning', e.target.value)}>
              {['off', 'low', 'medium', 'high'].map(k => <option key={k} value={k}>{t['advR_' + k]}</option>)}
            </select></label>
          <button className="btn sm ghost" onClick={() => setShowCfg(!showCfg)}>{t.advSettings} {showCfg ? '▾' : '▸'}</button>
          <button className="btn sm" disabled={busy || !msgs.length} onClick={() => setMsgs(() => [])}>{t.advNew}</button>
        </div>
        {showCfg && (
          <div className="grid g2" style={{ gap: 8 }}>
            <label className="col small" style={{ gap: 4 }}><span className="muted">{t.advUrl}</span><input value={cfg.url} onChange={e => setCfg('url', e.target.value)} /></label>
            <label className="col small" style={{ gap: 4 }}><span className="muted">{t.advKey}</span><input type="password" value={cfg.key} onChange={e => setCfg('key', e.target.value)} /></label>
            <span className="muted small" style={{ gridColumn: '1 / -1' }}>{t.advHelp}</span>
            <div className="col" style={{ gridColumn: '1 / -1', gap: 8, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
              <span className="bold small">{t.advStrata}</span>
              {sInfo && !sInfo.supported && <span className="muted small">{t.aiWinOnly}</span>}
              {sInfo?.supported && !sInfo.cmd && <span className="small">{t.advStrataMissing}</span>}
              {sInfo?.cmd && <>
                <span className="muted small">{t.advStrataFound}: <code>{sInfo.cmd}</code></span>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={!!cfg.autoStart} onChange={e => setCfg('autoStart', e.target.checked)} />{t.advAutoStart}</label>
                <label className="row small" style={{ gap: 8 }}>{t.advPreset}
                  <select value={cfg.preset} onChange={e => setCfg('preset', e.target.value)}>
                    {!cfg.preset && <option value="">—</option>}
                    {(sPresets || []).map(p => <option key={p.name} value={p.name}>{p.name}{p.model ? ' · ' + p.model : ''}</option>)}
                  </select>
                  <button className="btn sm ghost" onClick={loadStrata}>↻</button>
                </label>
                {sPresets && !sPresets.length && <span className="small">{t.advStrataNoPreset}</span>}
                <label className="row small" style={{ gap: 8 }}>{t.advIdle}
                  <input type="number" min="0" max="240" value={cfg.idle} onChange={e => setCfg('idle', Math.max(0, Number(e.target.value) || 0))} style={{ width: 80 }} /></label>
                <label className="row small" style={{ gap: 6 }}><input type="checkbox" checked={cfg.stopBeforePaint !== false} onChange={e => setCfg('stopBeforePaint', e.target.checked)} />{t.advStopBeforePaint}</label>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn sm" disabled={!!sProg || conn?.ok || !cfg.preset} onClick={startStrata}>{t.advStrataStart}</button>
                  <button className="btn sm" disabled={!sInfo.startedByUs} onClick={() => api.strata.stop({ cmd: cfg.cmd }).then(() => setTimeout(check, 1500))}>{t.advStrataStop}</button>
                </div>
              </>}
              <label className="col small" style={{ gap: 4 }}><span className="muted">{t.advStrataCmd}</span>
                <input value={cfg.cmd} placeholder="…\\Strata\\terminal\\<version>\\bin\\strata.cmd" onChange={e => setCfg('cmd', e.target.value)} /></label>
            </div>
          </div>
        )}
        {sProg && <div className="banner info" style={{ margin: 0, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div className="row" style={{ gap: 10 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /><span className="small grow">{t.advStrataStarting} · {Math.floor(sProg.seconds / 60)}:{String(sProg.seconds % 60).padStart(2, '0')}</span>
            <button className="btn sm" onClick={async () => { await api.strata.cancel?.({ cmd: cfg.cmd }); setSProg(null); check(); }}>{t.cancel}</button></div>
          {sProg.lines?.length > 0 && <pre className="small muted" style={{ margin: 0, whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto' }}>{sProg.lines.join('\n')}</pre>}
          {(sProg.exited != null || sProg.seconds > 120) && <span className="small">{t.advStrataSlow(sProg.url || cfg.url)}</span>}
        </div>}
        {conn && !conn.ok && !sProg && <div className="banner info" style={{ margin: 0 }}><span className="small grow">{canAuto ? t.advAutoNote(cfg.preset) : t.advNoServer}</span>{canAuto && <button className="btn sm primary" onClick={startStrata}>{t.advStrataStart}</button>}<button className="btn sm" onClick={check}>{t.t3Recheck}</button></div>}
        <div ref={listRef} className="col chatlist" style={{ gap: 10, overflowY: 'auto', flex: '1 1 0', minHeight: 180 }}>
          {msgs.length === 0 && !live && <div className="muted" style={{ margin: 'auto', maxWidth: 520, textAlign: 'center' }}>{t.advEmpty}</div>}
          {msgs.map(renderMsg)}
          {live && (
            <div className="chatmsg assistant">
              {live.think && !live.text && <div className="muted small" style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'hidden' }}>💭 {live.think.slice(-400)}</div>}
              <div className="chatbubble">{live.text ? <Markdown text={live.text} /> : <span className="muted">{t.advTyping}</span>}</div>
            </div>
          )}
        </div>
        {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small">{err}</span></div>}
        <div className="row small wrap" style={{ gap: 10 }}>
          <label className="row" style={{ gap: 6 }}>{t.advResult}
            <select value={advMode} onChange={e => setAdv('mode', e.target.value)} aria-label={t.advResult}>
              <option value="sliders">{t.advResultSliders}</option>
              <option value="prompt">{t.advResultPrompt}</option>
            </select></label>
          <span className="muted">{t.advModel}: <b>{MODEL_INFO[curModel].name}</b></span>
          <label className="row" style={{ gap: 6 }}>{t.advStyle}
            <select value={advStyle} onChange={e => setAdv('style', e.target.value)} aria-label={t.advStyle}>
              <option value="painter">{t.advStylePainter}</option>
              <option value="free">{t.advStyleFree}</option>
              {STYLES.filter(x => x[0] !== 'custom').map(([k, l]) => <option key={k} value={k}>{l[lang]}</option>)}
              {savedStyles.map(x => <option key={x.id} value={'saved:' + x.id}>★ {x.name}</option>)}
            </select></label>
        </div>
        <BigText rows={3} value={input} placeholder={t.advPlaceholder} aria-label={t.advPlaceholder} style={{ resize: 'vertical', minHeight: 70 }}
          onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); }} />
        <div className="row small" style={{ gap: 10 }}>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={withSheet} onChange={e => setWithSheet(e.target.checked)} />{t.advWithSheet}</label>
          <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={withImage} disabled={!ch.selectedPainting} onChange={e => setWithImage(e.target.checked)} />{t.advWithImage}</label>
          <span className="grow" />
          {busy ? <button className="btn" onClick={() => api.llm.stop()}>{t.advStop}</button>
            : <button className="btn primary" disabled={!input.trim() || (conn && !conn.ok && !canAuto)} onClick={send}>{t.advSend}</button>}
        </div>
      </section>
    </div>
  );
}
