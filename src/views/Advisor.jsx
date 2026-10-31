import React, { useEffect, useRef, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { DEFAULT_PAINTER } from '../ai/prompt.js';
import Markdown from '../components/Markdown.jsx';

const DEFAULT_URL = 'http://127.0.0.1:8080/v1';

function systemPrompt(lang, imageModel) {
  return `You are an expert prompt designer for AI character art of Dungeons & Dragons characters.
Talk with the user in ${lang === 'de' ? 'German' : 'English'}. Find out how their character should look: species anatomy, face, hair, body shape, age, clothing, armor, weapons, pose, mood, art style, lighting, framing.
Ask at most 2-3 short questions at a time and make concrete suggestions. Use the character sheet facts you are given.
Whenever you have enough information, or the user asks for it, write the final image prompt.
Rules for the image prompt:
- Always in English, inside a fenced code block that starts with \`\`\`prompt and ends with \`\`\`.
- One flowing paragraph of 80-200 words in natural descriptive language (no keyword soup, no weights like (word:1.2)).
- Start with the framing (e.g. "Full body shot of ..."), then species and anatomy, body, face, hair, clothing and gear, pose, then art style, lighting and background.
- Non-human species must be described anatomically and explicitly (e.g. an aarakocra has a full eagle head, feathers all over the body, wings on the back, bird legs with talons; it is not a human with feathers).
- Fully clothed, safe for work.
- ${imageModel === 'qwen' ? 'The image model is Qwen Image 2.1. If useful, add a second fenced block starting with ```negative for things to avoid.' : 'The image model is Z-Image Turbo. It does NOT understand negative prompts, so describe only what should be visible (say "photorealistic" instead of "not anime").'}
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
  const out = { prompt: null, negative: null };
  const re = /```(\w*)\s*\n([\s\S]*?)```/g; let m;
  while ((m = re.exec(text || ''))) {
    const tag = m[1].toLowerCase();
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
    try { await api.strata.start({ cmd: cfg.cmd, preset: cfg.preset, url: cfg.url, key: cfg.key }); await check(); }
    catch (e) { const m = String(e.message || e); setErr(/STRATA_NOT_FOUND/.test(m) ? t.advStrataMissing : /STRATA_NO_PRESET/.test(m) ? t.advStrataNoPreset : m); }
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
  const listRef = useRef(null);
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
    const system = systemPrompt(lang, ch.painter?.model === 'qwen' ? 'qwen' : 'zimage') + (withSheet ? '\n\nCharacter sheet:\n' + sheetFacts(ch, d) : '');
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

  const takeOver = (block) => update(c => {
    c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), promptMode: 'free', freePrompt: block.prompt, ...(block.negative ? { customNegative: block.negative } : {}) };
    c.designerMode = 'painter'; return c;
  });

  const renderMsg = (m, i) => {
    const blocks = m.role === 'assistant' ? extractBlocks(m.content) : {};
    return (
      <div key={i} className={'chatmsg ' + m.role}>
        <div className="chatbubble"><Markdown text={m.content} /></div>
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
      <section className="card col" style={{ flex: '999 1 600px', minWidth: 0, gap: 10 }}>
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
        {sProg && <div className="banner info" style={{ margin: 0 }}><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /><span className="small">{t.advStrataStarting} · {Math.floor(sProg.seconds / 60)}:{String(sProg.seconds % 60).padStart(2, '0')}<br /><span className="muted">{(sProg.line || '').slice(0, 120)}</span></span></div>}
        {conn && !conn.ok && !sProg && <div className="banner info" style={{ margin: 0 }}><span className="small grow">{canAuto ? t.advAutoNote(cfg.preset) : t.advNoServer}</span>{canAuto && <button className="btn sm primary" onClick={startStrata}>{t.advStrataStart}</button>}<button className="btn sm" onClick={check}>{t.t3Recheck}</button></div>}
        <div ref={listRef} className="col chatlist" style={{ gap: 10, overflowY: 'auto', height: 'max(300px, calc(100vh - 380px))' }}>
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
        <textarea rows={3} value={input} placeholder={t.advPlaceholder} aria-label={t.advPlaceholder} style={{ resize: 'vertical', minHeight: 70 }}
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
