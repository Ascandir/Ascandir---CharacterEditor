import React, { useEffect, useState } from 'react';
import { useT } from '../i18n.js';
import { api } from '../platform.js';
import { assessGpu, AMD_DRIVER_URL } from '../hardware.js';
import { useUpdater, UpdateBody } from '../components/Update.jsx';
import { Collapsible } from '../components/Shared.jsx';
import Markdown from '../components/Markdown.jsx';
import changelog from '../../CHANGELOG.md?raw';

export default function Settings({ globalSettings: s, saveSettings, showToast }) {
  const { t } = useT();
  const [hw, setHw] = useState(null);
  const [ver, setVer] = useState('');
  useEffect(() => { api.hardware().then(setHw); api.version().then(setVer); }, []);
  const gpus = (hw?.gpus || []).map(assessGpu);
  const u = useUpdater();
  return (
    <div className="page">
      <section className="col" style={{ flex: '1 1 340px', maxWidth: 460 }}>
        <div className="card col">
          <span className="bold">{t.language}</span>
          <div className="seg">
            <button className={s.lang === 'de' ? 'on' : ''} onClick={() => saveSettings({ ...s, lang: 'de' })}>Deutsch</button>
            <button className={s.lang === 'en' ? 'on' : ''} onClick={() => saveSettings({ ...s, lang: 'en' })}>English</button>
          </div>
          <span className="muted small">{t.langNote}</span>
        </div>
        <div className="card col">
          <span className="bold">{t.driver}</span>
          {gpus.length === 0 && <span className="muted small">{t.driverUnknown}</span>}
          {gpus.map((g, i) => (
            <div key={i} className="col" style={{ gap: 4 }}>
              <div className="row">
                <span className="dot" style={{ background: g.status === 'ok' ? 'var(--ok)' : g.status === 'old' ? 'var(--accent)' : 'var(--dim)' }} />
                <span className="bold grow">{g.name}</span>
              </div>
              <span className="muted small">{g.driverVersion} {g.driverDate ? '· ' + g.driverDate.slice(0, 10) : ''} · {g.status === 'ok' ? t.driverOk : g.status === 'old' ? t.driverOld : '—'}</span>
              {g.status === 'old' && <button className="btn sm" onClick={() => api.openExternal(AMD_DRIVER_URL)}>{t.driverLink}</button>}
            </div>
          ))}
          {hw?.ramGB && <span className="muted small">RAM: {hw.ramGB} GB</span>}
          <span className="muted small">{t.driverNote}</span>
        </div>
      </section>
      <section className="col" style={{ flex: '999 1 480px', minWidth: 0 }}>
        <div className="card col">
          <span className="bold">{t.aiModels}</span>
          <div className="banner info" style={{ margin: 0 }}>{t.aiSoon}</div>
        </div>
        <div className="card col">
          <div className="row"><span className="bold grow">{t.updates}</span><span className="muted">{t.version} {ver}</span></div>
          <button className="btn" disabled={['checking', 'downloading', 'installing'].includes(u.state)} onClick={u.check}>{u.state === 'checking' ? '…' : t.checkUpdate}</button>
          <UpdateBody u={u} />
          <label className="row small"><input type="checkbox" checked={s.autoUpdate !== false} onChange={e => saveSettings({ ...s, autoUpdate: e.target.checked })} />{t.autoUpdateCheck}</label>
        </div>
        <Collapsible title="Changelog" defaultOpen={false}>
          <div className="scroll" style={{ maxHeight: 480 }}><Markdown text={changelog} /></div>
        </Collapsible>
        <div className="card col">
          <button className="btn" onClick={async () => { await api.clearCache(); showToast('OK'); }}>{t.cacheClear}</button>
        </div>
      </section>
    </div>
  );
}
