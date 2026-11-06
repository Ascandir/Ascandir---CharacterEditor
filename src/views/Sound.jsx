import React, { useEffect, useRef, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';
import { useJob, useJobs, finishJob, cancelJob, fmtTime, jobPct } from '../ai/jobs.js';
import BigText from '../components/BigText.jsx';
import NumInput from '../components/NumInput.jsx';
import Advisor from './Advisor.jsx';

// Sounds & music: sound effects with Stable Audio Open, music (instrumental or with vocals) with ACE-Step 1.5.
// Settings and the advisor chat live in the global settings (not tied to a character).

export const SND_DEFAULT = {
  mode: 'gen', kind: 'music',
  sfx: { prompt: '', seconds: 6, count: 2, title: '' },
  music: { tags: '', lyrics: '', vocals: false, seconds: 90, bpm: 100, key: 'D minor', timesig: '4', language: 'de', count: 1, title: '' },
  messages: [],
};
const MODEL_ID = { sfx: 'stable-audio', music: 'ace-step-15' };
const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].flatMap(r => [r + ' major', r + ' minor']);
const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['fr', 'Français'], ['es', 'Español'], ['it', 'Italiano'], ['la', 'Latina'], ['ja', '日本語'], ['zh', '中文'], ['ru', 'Русский'], ['unknown', '?']];

function soundSystem(lang, kind) {
  const talk = lang === 'de' ? 'German' : 'English';
  if (kind === 'sfx') return `You are a sound designer who writes prompts for the local AI sound effect model "Stable Audio Open 1.0" (text to audio, max 47 seconds).
The user makes sounds for Dungeons & Dragons sessions (spells, weapons, monsters, ambience, foley). Talk with the user in ${talk}.
Ask at most 2 short questions at a time (what exactly makes the sound, material, size, distance, room or outdoor, mood, loop or single hit, length) and make concrete suggestions.
Whenever you have enough information or the user asks for it, output one fenced code block that starts with \`\`\`settings and contains only JSON:
{"kind":"sfx","title":"short name in the user's language","prompt":"English prompt","seconds":number 1-47}
Rules for the English prompt:
- One or two plain sentences describing only the sound itself: the source and action, materials, character of the sound (sharp, deep, crackling, metallic ...), distance and room (close-up, large stone hall, open field), and recording quality (e.g. "high quality foley recording, clean, no background noise").
- Stable Audio Open does not understand fantasy names: describe what you would hear instead (a "fireball" is "a roaring burst of fire with a deep whoosh and crackling flames").
- No music, no speech, no words that should be spoken (the model cannot speak).
- Short hits: 1-4 seconds. Ambience and loops: 20-47 seconds.
After the block explain in 1-2 short sentences (in the user's language) what you set.`;
  return `You are a composer who writes prompts for the local AI music model "ACE-Step 1.5" (text to music, instrumental or with vocals, up to several minutes).
The user makes music for Dungeons & Dragons sessions (tavern songs, battle themes, ambience, character themes, bard songs). Talk with the user in ${talk}.
Ask at most 2 short questions at a time (genre, mood, instruments, tempo, length, vocals or instrumental, language and theme of the lyrics) and make concrete suggestions.
Whenever you have enough information or the user asks for it, output one fenced code block that starts with \`\`\`settings and contains only JSON:
{"kind":"music","title":"short name in the user's language","vocals":true|false,"tags":"English style tags","lyrics":"lyrics with section tags or empty","language":"de|en|fr|es|it|la|ja|zh|ru","bpm":number 40-200,"key":"e.g. D minor","timesig":"2|3|4|6","seconds":number 15-600}
Rules:
- tags: comma separated English descriptors in this order: genre, mood, main instruments, tempo feel, production. With vocals add the voice (e.g. "male baritone vocal, choir", "female folk vocal, breathy"). Example: "medieval folk, tavern, cheerful, lute, fiddle, hand drum, tin whistle, lively, acoustic recording".
- vocals false: "lyrics" must be "" (the app makes it instrumental).
- vocals true: write complete singable lyrics in the chosen language with section tags on their own lines: [Intro], [Verse 1], [Chorus], [Verse 2], [Bridge], [Outro]. Short lines that rhyme, about 4 lines per section. The length of the lyrics should fit the duration (about 1 verse + chorus per 40 seconds).
- Pick a key and tempo that fit the mood (battle: fast, minor; tavern: lively, major; sad: slow, minor; 3/4 for waltzes and shanties).
After the block explain in 1-2 short sentences (in the user's language) what you set.`;
}

function SoundItem({ s, t, onRemove, onUse, onRename }) {
  const [src, setSrc] = useState(null);
  useEffect(() => () => { if (src?.startsWith('blob:')) URL.revokeObjectURL(src); }, [src]);
  const [name, setName] = useState(s.title || '');
  useEffect(() => setName(s.title || ''), [s.title]);
  return (
    <div className="card col" style={{ gap: 6, padding: 10 }}>
      <div className="row" style={{ gap: 8 }}>
        <span className="tag">{s.kind === 'sfx' ? t.sndSfx : s.vocals ? t.sndVocal : t.sndInstr}</span>
        <input className="grow" value={name} aria-label={t.sndName} onChange={e => setName(e.target.value)} onBlur={() => name !== s.title && onRename(name)} />
        <span className="muted small">{fmtTime(Math.round(s.seconds || 0))}</span>
      </div>
      {src ? <audio controls autoPlay src={src} style={{ width: '100%' }} />
        : <button className="btn sm" onClick={async () => {
          const d = await api.sounds.load(s.id);
          // long tracks are large: play them from a blob instead of a huge data URL
          try { setSrc(URL.createObjectURL(await (await fetch(d)).blob())); } catch { setSrc(d); }
        }}>▶ {t.sndPlay}</button>}
      <div className="muted small" style={{ whiteSpace: 'pre-wrap', maxHeight: 48, overflow: 'hidden' }}>{s.kind === 'sfx' ? s.prompt : s.tags}</div>
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm" onClick={() => api.sounds.exportFile(s.id, s.title || s.kind)}>{t.sndExport}</button>
        <button className="btn sm ghost" onClick={onUse}>{t.sndReuse}</button>
        <span className="grow" />
        <button className="btn sm danger" onClick={onRemove}>{t.delete}</button>
      </div>
    </div>
  );
}

export default function Sound(props) {
  const { globalSettings, saveSettings } = props;
  const { t, lang } = useT();
  const gsRef = useRef(globalSettings); gsRef.current = globalSettings;
  const raw = globalSettings?.sound || {};
  const snd = { ...SND_DEFAULT, ...raw, sfx: { ...SND_DEFAULT.sfx, ...(raw.sfx || {}) }, music: { ...SND_DEFAULT.music, ...(raw.music || {}) } };
  const setSnd = (fn) => {
    const g = gsRef.current || {};
    const cur = { ...SND_DEFAULT, ...(g.sound || {}) };
    const next = { ...g, sound: fn(cur) };
    gsRef.current = next; saveSettings(next);
  };
  const setPart = (kind, k, v) => setSnd(c => ({ ...c, [kind]: { ...SND_DEFAULT[kind], ...(c[kind] || {}), [k]: v } }));
  const kind = snd.kind === 'sfx' ? 'sfx' : 'music';
  const cur = snd[kind];

  const [st, setSt] = useState(null);
  const refresh = () => api.ai.status().then(setSt).catch(() => setSt({ supported: false }));
  useEffect(() => { refresh(); const o = api.ai.on('ai:state', refresh); return o; }, []);
  const [list, setList] = useState([]);
  const loadList = () => api.sounds.list().then(setList).catch(() => setList([]));
  useEffect(() => { loadList(); }, []);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useJob('sound');
  const jobs = useJobs();
  const [err, setErr] = useState(null);
  const [inst, setInst] = useState(null);

  const modelOk = !!st?.models?.[MODEL_ID[kind]]?.present;
  const install = async () => {
    setInst('0 %'); setErr(null);
    const off = api.ai.on('ai:progress', pr => setInst(pr.label ? `${pr.pct ?? 0} %` : (pr.pct ?? 0) + ' %'));
    try { await api.ai.install({ dir: st.dir, gpu: st.gpu, models: [MODEL_ID[kind]], comfy: false }); } catch (e) { setErr(String(e.message || e)); }
    off(); setInst(null); refresh();
  };

  const generate = async () => {
    if (busy || jobs.paint) { if (jobs.paint) setErr(t.sndBusyOther); return; }
    setErr(null);
    const p = cur;
    if (kind === 'sfx' ? !p.prompt.trim() : !p.tags.trim()) { setErr(t.sndNeedText); return; }
    if (kind === 'music' && p.vocals && !p.lyrics.trim()) { setErr(t.sndNeedLyrics); return; }
    setBusy({ seconds: 0, kind });
    let ok = false; let msg = null;
    try {
      const lc = globalSettings?.llm || {};
      if (lc.stopBeforePaint !== false) { try { await api.strata.stop({ cmd: lc.cmd }); } catch { /* not running */ } }
      const seed = Math.floor(Math.random() * 2 ** 31);
      const params = kind === 'sfx'
        ? { model: 'sfx', prompt: p.prompt.trim(), seconds: p.seconds, batch: p.count, seed }
        : { model: 'music', tags: p.tags.trim(), lyrics: p.lyrics, vocals: !!p.vocals, seconds: p.seconds, bpm: p.bpm, key: p.key, timesig: p.timesig, language: p.language, batch: p.count, seed };
      const r = await api.ai.generate(params);
      const base = (p.title || '').trim() || (kind === 'sfx' ? p.prompt : p.tags).split(/[,.]/)[0].slice(0, 40);
      for (const [i, a] of (r.audios || []).entries()) {
        await api.sounds.save(a, { kind, title: base + ((r.audios.length > 1) ? ' ' + (i + 1) : ''), seconds: p.seconds, vocals: kind === 'music' && !!p.vocals,
          prompt: p.prompt, tags: p.tags, lyrics: kind === 'music' && p.vocals ? p.lyrics : '', bpm: p.bpm, key: p.key, timesig: p.timesig, language: p.language, seed });
      }
      ok = true;
    } catch (e) {
      const m = String(e.message || e); msg = /CANCELLED/.test(m) ? 'CANCELLED' : m;
      if (msg !== 'CANCELLED') setErr(/COMFY_TOO_OLD/.test(m) ? t.sndComfyOld : m);
    }
    finishJob('sound', ok, msg);
    loadList();
  };

  const reuse = (s) => {
    setSnd(c => ({ ...c, mode: 'gen', kind: s.kind, [s.kind]: s.kind === 'sfx'
      ? { ...SND_DEFAULT.sfx, ...(c.sfx || {}), prompt: s.prompt || '', seconds: s.seconds || 6, title: s.title || '' }
      : { ...SND_DEFAULT.music, ...(c.music || {}), tags: s.tags || '', lyrics: s.lyrics || '', vocals: !!s.vocals, seconds: s.seconds || 90, bpm: s.bpm || 100, key: s.key || 'D minor', timesig: s.timesig || '4', language: s.language || 'de', title: s.title || '' } }));
    window.scrollTo?.(0, 0);
  };

  const adapter = {
    messages: snd.messages || [],
    setMsgs: (fn) => setSnd(c => ({ ...c, messages: fn(c.messages || []).slice(-60) })),
    model: kind, modelName: kind === 'sfx' ? 'Stable Audio Open 1.0' : 'ACE-Step 1.5',
    mode: 'sliders', set: () => {}, noMode: true, noImage: true, hasImage: false, getImage: async () => null,
    system: (lg) => soundSystem(lg, kind),
    empty: kind === 'sfx' ? t.sndAdvEmptySfx : t.sndAdvEmptyMusic,
    placeholder: t.sndAdvPlaceholder,
    applyLabel: t.sndAdvApply,
    extra: (
      <div className="seg">
        <button className={kind === 'music' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, kind: 'music' }))}>{t.sndMusic}</button>
        <button className={kind === 'sfx' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, kind: 'sfx' }))}>{t.sndSfx}</button>
      </div>
    ),
    applySettings: (s) => setSnd(c => {
      const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : d);
      if (s.kind === 'sfx' || (!s.kind && kind === 'sfx')) {
        const o = { ...SND_DEFAULT.sfx, ...(c.sfx || {}) };
        return { ...c, mode: 'gen', kind: 'sfx', sfx: { ...o, prompt: typeof s.prompt === 'string' ? s.prompt : o.prompt, seconds: num(s.seconds, 1, 47, o.seconds), title: typeof s.title === 'string' ? s.title : o.title } };
      }
      const o = { ...SND_DEFAULT.music, ...(c.music || {}) };
      const vocals = typeof s.vocals === 'boolean' ? s.vocals : o.vocals;
      return { ...c, mode: 'gen', kind: 'music', music: { ...o, vocals,
        tags: typeof s.tags === 'string' ? s.tags : o.tags,
        lyrics: typeof s.lyrics === 'string' ? s.lyrics : o.lyrics,
        language: LANGS.some(l => l[0] === s.language) ? s.language : o.language,
        bpm: num(s.bpm, 30, 300, o.bpm), seconds: num(s.seconds, 10, 600, o.seconds),
        key: KEYS.find(k => k.toLowerCase() === String(s.key || '').toLowerCase().replace(/maj$/, 'major').replace(/min$/, 'minor')) || o.key,
        timesig: ['2', '3', '4', '6'].includes(String(s.timesig)) ? String(s.timesig) : o.timesig,
        title: typeof s.title === 'string' ? s.title : o.title } };
    }),
    takeOver: (b) => setSnd(c => (kind === 'sfx' ? { ...c, mode: 'gen', sfx: { ...SND_DEFAULT.sfx, ...(c.sfx || {}), prompt: b.prompt } } : { ...c, mode: 'gen', music: { ...SND_DEFAULT.music, ...(c.music || {}), tags: b.prompt } })),
  };

  const shown = list.filter(s => filter === 'all' || (filter === 'sfx' ? s.kind === 'sfx' : s.kind === 'music'));
  const pct = jobPct(busy);
  const modelNote = kind === 'sfx' ? t.sndModelSfx : t.sndModelMusic;

  return (
    <>
      <div className="row" style={{ padding: '14px 22px 0' }}>
        <div className="seg" style={{ minWidth: 300 }}>
          <button className={snd.mode !== 'advisor' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, mode: 'gen' }))}>{t.sndGen}</button>
          <button className={snd.mode === 'advisor' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, mode: 'advisor' }))}>{t.designerAdvisor}</button>
        </div>
      </div>
      {snd.mode === 'advisor' ? <Advisor {...props} ch={null} adapter={adapter} /> : (
        <div className="page">
          <section className="card col" style={{ flex: '1 1 460px', maxWidth: 640, gap: 12 }}>
            <div className="seg">
              <button className={kind === 'music' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, kind: 'music' }))}>🎵 {t.sndMusic}</button>
              <button className={kind === 'sfx' ? 'on' : ''} onClick={() => setSnd(c => ({ ...c, kind: 'sfx' }))}>💥 {t.sndSfx}</button>
            </div>
            <span className="muted small">{modelNote}</span>
            {st && !st.supported && <div className="banner info" style={{ margin: 0 }}><span className="small">{t.aiWinOnly}</span></div>}
            {st?.supported && !st.comfyInstalled && <div className="banner info" style={{ margin: 0 }}><span className="small grow">{t.sndNoComfy}</span><button className="btn sm" onClick={() => props.setView('settings')}>{t.tabSettings}</button></div>}
            {st?.supported && st.comfyInstalled && !modelOk && (
              <div className="banner info" style={{ margin: 0 }}>
                <span className="small grow">{t.sndModelMissing(kind === 'sfx' ? 'Stable Audio Open 1.0 (5,4 GB)' : 'ACE-Step 1.5 Turbo (9,3 GB)')}</span>
                <button className="btn sm primary" disabled={!!inst} onClick={install}>{inst ? t.sndLoading + ' ' + inst : t.sndLoadModel}</button>
                {inst && <button className="btn sm" onClick={() => api.ai.cancel()}>{t.cancel}</button>}
              </div>
            )}

            <label className="col small" style={{ gap: 4 }}><span className="muted">{t.sndName}</span>
              <input value={cur.title} placeholder={t.sndNameHint} onChange={e => setPart(kind, 'title', e.target.value)} /></label>

            {kind === 'sfx' ? (
              <>
                <label className="col small" style={{ gap: 4 }}><span className="muted">{t.sndSfxPrompt}</span>
                  <BigText rows={4} value={cur.prompt} placeholder={t.sndSfxPh} onChange={e => setPart('sfx', 'prompt', e.target.value)} /></label>
                <div className="row wrap" style={{ gap: 14 }}>
                  <label className="row small" style={{ gap: 8 }}>{t.sndLen}
                    <input type="range" min="1" max="47" value={cur.seconds} onChange={e => setPart('sfx', 'seconds', Number(e.target.value))} />
                    <b style={{ minWidth: 40 }}>{cur.seconds} s</b></label>
                  <label className="row small" style={{ gap: 8 }}>{t.sndCount}
                    <select value={cur.count} onChange={e => setPart('sfx', 'count', Number(e.target.value))}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                </div>
              </>
            ) : (
              <>
                <div className="seg">
                  <button className={!cur.vocals ? 'on' : ''} onClick={() => setPart('music', 'vocals', false)}>{t.sndInstr}</button>
                  <button className={cur.vocals ? 'on' : ''} onClick={() => setPart('music', 'vocals', true)}>{t.sndVocal}</button>
                </div>
                <label className="col small" style={{ gap: 4 }}><span className="muted">{t.sndTags}</span>
                  <BigText rows={3} value={cur.tags} placeholder={t.sndTagsPh} onChange={e => setPart('music', 'tags', e.target.value)} /></label>
                {cur.vocals && (
                  <>
                    <label className="col small" style={{ gap: 4 }}><span className="muted">{t.sndLyrics}</span>
                      <BigText rows={8} value={cur.lyrics} placeholder={t.sndLyricsPh} onChange={e => setPart('music', 'lyrics', e.target.value)} /></label>
                    <label className="row small" style={{ gap: 8 }}>{t.sndLang}
                      <select value={cur.language} onChange={e => setPart('music', 'language', e.target.value)}>{LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  </>
                )}
                <div className="row wrap" style={{ gap: 14 }}>
                  <label className="row small" style={{ gap: 8 }}>{t.sndLen}
                    <input type="range" min="10" max="600" step="5" value={cur.seconds} onChange={e => setPart('music', 'seconds', Number(e.target.value))} />
                    <b style={{ minWidth: 44 }}>{fmtTime(cur.seconds)}</b></label>
                  <label className="row small" style={{ gap: 8 }}>{t.sndBpm}
                    <NumInput min={30} max={300} value={cur.bpm} style={{ width: 70 }} onChange={v => setPart('music', 'bpm', v)} /></label>
                  <label className="row small" style={{ gap: 8 }}>{t.sndKey}
                    <select value={cur.key} onChange={e => setPart('music', 'key', e.target.value)}>{KEYS.map(k => <option key={k} value={k}>{lang === 'de' ? k.replace(' major', '-Dur').replace(' minor', '-Moll') : k}</option>)}</select></label>
                  <label className="row small" style={{ gap: 8 }}>{t.sndTime}
                    <select value={cur.timesig} onChange={e => setPart('music', 'timesig', e.target.value)}>{['2', '3', '4', '6'].map(k => <option key={k} value={k}>{k}/4</option>)}</select></label>
                  <label className="row small" style={{ gap: 8 }}>{t.sndCount}
                    <select value={cur.count} onChange={e => setPart('music', 'count', Number(e.target.value))}>{[1, 2].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                </div>
              </>
            )}
            <span className="muted small">{t.sndEnHint}</span>
            {err && <div className="banner" style={{ margin: 0, borderColor: '#6a3a33', background: '#2a1714' }}><span className="small" style={{ whiteSpace: 'pre-wrap' }}>{err}</span></div>}
            {busy ? (
              <div className="row" style={{ gap: 10 }}>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                <span className="grow small">{busy.cancelling ? t.pCancelling : (pct == null ? t.sndWorking : pct + ' %')} · {fmtTime(busy.seconds)}</span>
                {!busy.cancelling && <button className="btn sm" onClick={() => cancelJob('sound')}>{t.cancel}</button>}
              </div>
            ) : (
              <button className="btn primary" disabled={!modelOk || !!jobs.paint} onClick={generate}>{kind === 'sfx' ? t.sndMakeSfx : t.sndMakeMusic}</button>
            )}
          </section>

          <section className="col" style={{ flex: '1 1 380px', minWidth: 0, gap: 10 }}>
            <div className="row" style={{ gap: 8 }}>
              <b className="grow">{t.sndLibrary} ({list.length})</b>
              <div className="seg">
                {[['all', t.sndAll], ['music', t.sndMusic], ['sfx', t.sndSfx]].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}
              </div>
              <button className="btn sm ghost" onClick={() => api.sounds.openDir()}>{t.sndOpenDir}</button>
            </div>
            {!shown.length && <div className="muted small">{t.sndEmpty}</div>}
            {shown.map(s => (
              <SoundItem key={s.id} s={s} t={t}
                onRemove={async () => { await api.sounds.remove(s.id); loadList(); }}
                onUse={() => reuse(s)}
                onRename={async (title) => { await api.sounds.update(s.id, { title }); loadList(); }} />
            ))}
          </section>
        </div>
      )}
    </>
  );
}
