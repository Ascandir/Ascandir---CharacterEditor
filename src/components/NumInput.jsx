import React, { useEffect, useState } from 'react';

// number field that lets you type freely: the value is only clamped when you leave the field or press Enter
// (clamping on every key turned "1" into the minimum 5 and then "16" into "56")
export default function NumInput({ value, min, max, onChange, ...rest }) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setDraft(String(value ?? '')); }, [value, focus]);
  const clamp = (n) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n));
  const commit = () => {
    const n = Number(draft);
    if (draft.trim() === '' || !isFinite(n)) { setDraft(String(value ?? '')); return; }
    const c = clamp(Math.round(n)); setDraft(String(c)); if (c !== value) onChange(c);
  };
  return (
    <input type="number" min={min} max={max} value={draft} {...rest}
      onFocus={e => { setFocus(true); rest.onFocus?.(e); }}
      onChange={e => {
        const v = e.target.value; setDraft(v);
        const n = Number(v);
        // values already inside the range apply right away (slider follows while typing)
        if (v.trim() !== '' && isFinite(n) && n >= (min ?? -Infinity) && n <= (max ?? Infinity)) onChange(Math.round(n));
      }}
      onBlur={e => { setFocus(false); commit(); rest.onBlur?.(e); }}
      onKeyDown={e => { if (e.key === 'Enter') commit(); rest.onKeyDown?.(e); }} />
  );
}
