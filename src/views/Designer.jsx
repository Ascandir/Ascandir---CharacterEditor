import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { DEFAULT_PAINTER } from '../ai/prompt.js';
import { useT } from '../i18n.js';
import Painter from './Painter.jsx';
import Trellis3D from './Trellis3D.jsx';
import Advisor from './Advisor.jsx';

export default function Designer(props) {
  const { t } = useT();
  const { ch, update, createChar } = props;
  const [models, setModels] = useState({});
  useEffect(() => {
    const load = () => api.ai.status().then(s => setModels(s.models || {})).catch(() => {});
    load();
    const o1 = api.ai.on('ai:progress', pr => { if (pr.phase === 'done') load(); });
    const o2 = api.ai.on('ai:state', load);
    return () => { o1(); o2(); };
  }, []);
  if (!ch) return <div className="loading"><button className="btn primary" onClick={createChar}>{t.newChar}</button></div>;
  const mode = ['trellis', 'advisor'].includes(ch.designerMode) ? ch.designerMode : 'painter';
  return (
    <>
      <div className="row" style={{ padding: '14px 22px 0' }}>
        <div className="seg" style={{ minWidth: 440 }}>
          <button className={mode === 'painter' ? 'on' : ''} onClick={() => update(c => { c.designerMode = 'painter'; return c; })}>{t.designerPainter}</button>
          <button className={mode === 'advisor' ? 'on' : ''} onClick={() => update(c => { c.designerMode = 'advisor'; return c; })}>{t.designerAdvisor}</button>
          <button className={mode === 'trellis' ? 'on' : ''} onClick={() => update(c => { c.designerMode = 'trellis'; return c; })}>{t.designer3d}</button>
        </div>
        <div className="grow" />
        {mode === 'painter' && (
          <label className="row small" style={{ gap: 8 }}>
            <span className="muted">{t.pModel}</span>
            <select value={({ qwen: 'qwen-image-21', qwenturbo: 'qwen-image-21-turbo' }[ch.painter?.model] && models[{ qwen: 'qwen-image-21', qwenturbo: 'qwen-image-21-turbo' }[ch.painter?.model]]?.present) ? ch.painter.model : 'zimage'} aria-label={t.pModel}
              onChange={e => update(c => { c.painter = { ...DEFAULT_PAINTER, ...(c.painter || {}), model: e.target.value }; return c; })}>
              <option value="zimage">Z-Image Turbo · {t.pFast}</option>
              <option value="qwenturbo" disabled={!models['qwen-image-21-turbo']?.present}>Qwen Image 2.1 Turbo · {t.pQwenTurbo}{models['qwen-image-21-turbo']?.present ? '' : ' (' + t.pNotLoaded + ')'}</option>
              <option value="qwen" disabled={!models['qwen-image-21']?.present}>Qwen Image 2.1 · {t.pBest}{models['qwen-image-21']?.present ? '' : ' (' + t.pNotLoaded + ')'}</option>
            </select>
          </label>
        )}
      </div>
      {mode === 'painter' ? <Painter {...props} /> : mode === 'advisor' ? <Advisor {...props} /> : <Trellis3D {...props} />}
    </>
  );
}
