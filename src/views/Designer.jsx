import React from 'react';
import { useT } from '../i18n.js';
import Painter from './Painter.jsx';
import Trellis3D from './Trellis3D.jsx';

export default function Designer(props) {
  const { t } = useT();
  const { ch, update, createChar } = props;
  if (!ch) return <div className="loading"><button className="btn primary" onClick={createChar}>{t.newChar}</button></div>;
  const mode = ch.designerMode === 'trellis' ? 'trellis' : 'painter';
  return (
    <>
      <div className="row" style={{ padding: '14px 22px 0' }}>
        <div className="seg" style={{ minWidth: 320 }}>
          <button className={mode === 'painter' ? 'on' : ''} onClick={() => update(c => { c.designerMode = 'painter'; return c; })}>{t.designerPainter}</button>
          <button className={mode === 'trellis' ? 'on' : ''} onClick={() => update(c => { c.designerMode = 'trellis'; return c; })}>{t.designer3d}</button>
        </div>
      </div>
      {mode === 'painter' ? <Painter {...props} /> : <Trellis3D {...props} />}
    </>
  );
}
