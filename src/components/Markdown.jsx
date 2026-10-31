import React from 'react';

// Tiny markdown renderer for changelogs: headings, bullet lists, paragraphs.
export default function Markdown({ text }) {
  const blocks = [];
  let list = null; let code = null;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^\s*```/.test(line)) {
      if (code) { code = null; } else { code = { type: 'code', lang: line.trim().slice(3), lines: [] }; blocks.push(code); list = null; }
      return;
    }
    if (code) { code.lines.push(raw); return; }
    const li = /^\s*[-*]\s+(.*)$/.exec(line);
    if (li) { if (!list) { list = []; blocks.push({ type: 'ul', items: list }); } list.push(li[1]); return; }
    list = null;
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) blocks.push({ type: 'h', level: h[1].length, text: h[2] });
    else if (line.trim()) blocks.push({ type: 'p', text: line });
  });
  const inline = (s) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
  return (
    <div className="entries">
      {blocks.map((b, i) => {
        if (b.type === 'code') return <pre key={i} className="codeblock">{b.lang && <span className="codelang">{b.lang}</span>}{b.lines.join('\n')}</pre>;
        if (b.type === 'ul') return <ul key={i}>{b.items.map((x, j) => <li key={j}>{inline(x)}</li>)}</ul>;
        if (b.type === 'h') return b.level <= 1 ? null : <p key={i} style={{ marginTop: i ? 12 : 0 }}><b style={{ color: 'var(--accent2)' }}>{inline(b.text)}</b></p>;
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}
