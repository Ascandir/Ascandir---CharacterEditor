import React, { useMemo, useState } from 'react';
import { useT } from '../i18n.js';
import { confirmDialog } from '../components/Dialog.jsx';
import { makeFilter, multiclassReq, meetsReq, reqText, dedupeByName } from '../engine/rules.js';
import { uidOf } from '../data/loader.js';
import { Choices, Feature, ExtrasEditor, Collapsible } from '../components/Shared.jsx';

const rnd = (sides) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % sides); };

export default function LevelUp(props) {
  const { db, settings, ch, d, update, setView } = props;
  const { t } = useT();
  const [sel, setSel] = useState(null);
  const allowed = useMemo(() => makeFilter(db, settings), [db, settings]);
  const classes = useMemo(() => dedupeByName(db.classes.filter(allowed), settings.rules === '2014' ? 'PHB' : 'XPHB').sort((a, b) => a.name.localeCompare(b.name)), [db, allowed, settings.rules]);
  if (!ch || !d) return null;
  const total = ch.levels.length;
  const owned = new Set(ch.levels.map(l => l.classUid));
  const current = sel ?? (total ? total - 1 : null);
  const lo = current != null ? d.levelOut[current] : null;
  const L = current != null ? ch.levels[current] : null;
  const cls = L && db.byUid.class.get(L.classUid);
  const levelChoices = d.choices.filter(c => c.levelIndex === current);

  const addLevel = (uid) => {
    update(c => { c.levels.push({ classUid: uid, hpMode: 'avg' }); return c; });
    setSel(total);
  };
  return (
    <div className="page">
      <aside className="card col" style={{ flex: '1 1 250px', maxWidth: 320, gap: 8 }}>
        <div className="row"><b className="grow">{t.levels}</b><button className="btn sm ghost" onClick={() => setView('sheet')}>{t.tabSheet}</button></div>
        {d.levelOut.map((l, i) => {
          const open = d.choices.filter(c => c.levelIndex === i && c.required && !(c.value && (Array.isArray(c.value) ? c.value.length : true))).length;
          return (
            <button key={i} className={'listbtn' + (current === i ? ' sel' : '')} onClick={() => setSel(i)}>
              <span className="die">{i + 1}</span>
              <span className="grow col" style={{ gap: 2 }}>
                <span className="bold">{l.className} {l.classLevel}</span>
                <span className="small" style={{ color: open ? 'var(--accent2)' : 'var(--muted)' }}>{open ? t.openDecisions(open) : (l.newFeatures || []).map(f => f.name).slice(0, 3).join(', ')}</span>
              </span>
            </button>
          );
        })}
        <p className="muted small">{t.editLevelHint}</p>
      </aside>

      <section className="col" style={{ flex: '999 1 560px', minWidth: 0 }}>
        <Collapsible title={`${t.levelUp}: ${t.level} ${total} → ${total + 1}`}>
          <p className="muted" style={{ margin: '0 0 12px' }}>{t.whichClass}</p>
          <div className="optgrid">
            {classes.map(c => {
              const uid = uidOf(c);
              const req = multiclassReq(c);
              const isMc = total > 0 && !owned.has(uid);
              const firstUid = ch.levels[0]?.classUid;
              const firstCls = firstUid && db.byUid.class.get(firstUid);
              const ok = !isMc || (meetsReq(req, d.scores) && meetsReq(multiclassReq(firstCls), d.scores));
              const lvl = ch.levels.filter(l => l.classUid === uid).length;
              return (
                <button key={uid} className={'opt' + (ok ? '' : ' unmet')} disabled={!ok || total >= 20} onClick={() => addLevel(uid)}>
                  <span className="bold">{c.name}</span>
                  <span className="s">{owned.has(uid) ? `${t.level} ${lvl + 1}` : total ? `${t.multiclass} · ${reqText(req)}${ok ? ' ✓' : ''}` : ''}</span>
                  {!ok && <span className="s" style={{ color: 'var(--bad)' }}>{t.mcNeeds}</span>}
                </button>
              );
            })}
          </div>
        </Collapsible>

        {lo && cls && (
          <>
            <div className="card col">
              <div className="row">
                <h2 className="serif grow" style={{ fontSize: 20 }}>{t.level} {current + 1}: {cls.name} {lo.classLevel}</h2>
                {current === total - 1 && total > 1 && <button className="btn sm danger" onClick={() => { update(c => { c.levels.pop(); return c; }); setSel(null); }}>{t.removeLevel}</button>}
                {current < total - 1 && <button className="btn sm danger" onClick={async () => { if (await confirmDialog(t.removeLevel + '?')) { update(c => { c.levels.splice(current, 1); return c; }); setSel(null); } }}>{t.removeLevel}</button>}
              </div>
              {current > 0 && (
                <div className="row">
                  <span className="bold">{t.hp}:</span>
                  <div className="seg">
                    <button className={L.hpMode !== 'roll' ? 'on' : ''} onClick={() => update(c => { c.levels[current].hpMode = 'avg'; return c; })}>{t.hpAvg} ({Math.floor((cls.hd?.faces || 8) / 2) + 1})</button>
                    <button className={L.hpMode === 'roll' ? 'on' : ''} onClick={() => update(c => { c.levels[current].hpMode = 'roll'; c.levels[current].hpRoll = rnd(cls.hd?.faces || 8); return c; })}>{t.hpRoll} 1d{cls.hd?.faces}</button>
                  </div>
                  {L.hpMode === 'roll' && <span className="bold" style={{ fontSize: 18 }}>🎲 {L.hpRoll}</span>}
                  <span className="muted small">+ KON</span>
                </div>
              )}
              <b>{t.newOnLevel}</b>
              <div className="col" style={{ gap: 6 }}>{(lo.newFeatures || []).map((f, i) => <Feature key={i} f={f} />)}</div>
            </div>
            <Choices list={levelChoices} update={update} d={d} />
          </>
        )}
        <ExtrasEditor {...props} />
      </section>
    </div>
  );
}
