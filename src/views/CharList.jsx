import React, { useEffect, useState } from 'react';
import { api } from '../platform.js';
import { useT } from '../i18n.js';

export default function CharList({ onClose, openChar, createChar, current, setCh, showToast, saveSettings, globalSettings }) {
  const { t, lang } = useT();
  const [list, setList] = useState([]);
  const refresh = () => api.listChars().then(setList);
  useEffect(() => { refresh(); }, []);
  const del = async (id) => {
    if (!window.confirm(t.confirmDelete)) return;
    await api.deleteChar(id);
    if (current?.id === id) { setCh(null); saveSettings({ ...globalSettings, lastCharId: null }); }
    refresh();
  };
  const exportCur = async () => {
    if (!current) return;
    await api.saveFile({ defaultName: (current.name || 'character') + '.json', filters: [{ name: 'JSON', extensions: ['json'] }], text: JSON.stringify(current, null, 2) });
  };
  const importChar = async () => {
    const f = await api.openFile({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!f) return;
    try {
      const c = JSON.parse(f.text);
      if (!c.id || !Array.isArray(c.levels)) throw new Error('format');
      c.id = 'c' + Date.now().toString(36);
      await api.saveChar(c); refresh(); showToast(t.saved);
    } catch { showToast('Import failed'); }
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-label={t.myChars}>
        <div className="row">
          <h2 className="serif">{t.myChars}</h2>
          <div className="grow" />
          <button className="btn" onClick={importChar}>{t.import}</button>
          {current && <button className="btn" onClick={exportCur}>{t.export}</button>}
          <button className="btn primary" onClick={createChar}>{t.newChar}</button>
          <button className="btn ghost" onClick={onClose}>{t.close}</button>
        </div>
        <div className="col" style={{ gap: 8 }}>
          {list.length === 0 && <div className="muted">{t.noCharSub}</div>}
          {list.map(c => (
            <div key={c.id} className={'listbtn' + (current?.id === c.id ? ' sel' : '')}>
              <button style={{ all: 'unset', cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }} onClick={() => openChar(c.id)}>
                <span className="bold">{c.name || t.untitled}</span>
                <span className="muted small">{c.summary}</span>
              </button>
              <span className="muted small">{c.updatedAt ? new Date(c.updatedAt).toLocaleString(lang) : ''}</span>
              <button className="btn sm danger" onClick={() => del(c.id)}>{t.delete}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
