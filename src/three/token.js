// Token composition: circular portrait from a separate camera + a 2D ring that never rotates.
export const RINGS = [
  ['gold', { de: 'Gold', en: 'Gold' }],
  ['silver', { de: 'Silber', en: 'Silver' }],
  ['bronze', { de: 'Bronze mit Nieten', en: 'Riveted bronze' }],
  ['wood', { de: 'Holz', en: 'Wood' }],
  ['runic', { de: 'Runen', en: 'Runic' }],
  ['arcane', { de: 'Arkan (leuchtend)', en: 'Arcane (glow)' }],
  ['color', { de: 'Einfarbig', en: 'Solid color' }],
  ['none', { de: 'Kein Ring', en: 'No ring' }],
];

function metalGradient(ctx, s, stops) {
  const g = ctx.createLinearGradient(0, 0, s, s);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function drawRing(ctx, s, ring, color = '#E3A74B') {
  const c = s / 2; const R = s * 0.47; const w = s * 0.055;
  ctx.save();
  const stroke = (style, width, r = R) => { ctx.strokeStyle = style; ctx.lineWidth = width; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke(); };
  switch (ring) {
    case 'gold':
      stroke(metalGradient(ctx, s, [[0, '#fff1c1'], [0.35, '#d9a441'], [0.6, '#8a5a12'], [1, '#f5d27a']]), w);
      stroke('rgba(60,35,5,.8)', s * 0.006, R - w / 2); stroke('rgba(60,35,5,.8)', s * 0.006, R + w / 2);
      break;
    case 'silver':
      stroke(metalGradient(ctx, s, [[0, '#ffffff'], [0.4, '#aab2bd'], [0.65, '#5d646e'], [1, '#e6eaef']]), w);
      stroke('rgba(20,22,26,.8)', s * 0.006, R - w / 2); stroke('rgba(20,22,26,.8)', s * 0.006, R + w / 2);
      break;
    case 'bronze': {
      stroke(metalGradient(ctx, s, [[0, '#e7b98a'], [0.45, '#9a6232'], [1, '#c98f58']]), w * 1.15);
      ctx.fillStyle = '#f3d3a8';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ctx.beginPath(); ctx.arc(c + Math.cos(a) * R, c + Math.sin(a) * R, w * 0.18, 0, Math.PI * 2); ctx.fill(); }
      break;
    }
    case 'wood': {
      stroke('#6b4423', w * 1.2);
      ctx.strokeStyle = 'rgba(30,15,5,.55)'; ctx.lineWidth = s * 0.004;
      for (let i = 0; i < 5; i++) { const r = R - w * 0.5 + (i + 0.5) * (w * 1.2 / 5); ctx.beginPath(); ctx.arc(c, c, r, i * 0.7, i * 0.7 + Math.PI * 1.3); ctx.stroke(); }
      stroke('#3a230f', s * 0.006, R - w * 0.6); stroke('#3a230f', s * 0.006, R + w * 0.6);
      break;
    }
    case 'runic': {
      stroke('#1d1f26', w * 1.1);
      ctx.fillStyle = color; ctx.font = `bold ${Math.round(w * 1.0)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const runes = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
        ctx.save(); ctx.translate(c + Math.cos(a) * R, c + Math.sin(a) * R); ctx.rotate(a + Math.PI / 2); ctx.fillText(runes[i], 0, 0); ctx.restore();
      }
      stroke(color, s * 0.005, R - w * 0.55); stroke(color, s * 0.005, R + w * 0.55);
      break;
    }
    case 'arcane':
      ctx.shadowColor = color; ctx.shadowBlur = s * 0.04;
      stroke(color, s * 0.012, R - w * 0.3); stroke(color, s * 0.006, R + w * 0.35);
      ctx.shadowBlur = 0;
      ctx.fillStyle = color;
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(c + Math.cos(a) * (R + w * 0.02), c + Math.sin(a) * (R + w * 0.02), s * 0.008, 0, Math.PI * 2); ctx.fill(); }
      break;
    case 'color':
      stroke(color, w);
      break;
    default: break;
  }
  ctx.restore();
}

// Compose: background disc + rendered figure (clipped) + ring on top
export function composeToken(ctx, s, img, { ring = 'gold', color = '#E3A74B', bg = '#2a2e36', transparentBg = false } = {}) {
  const c = s / 2; const inner = s * 0.47;
  ctx.clearRect(0, 0, s, s);
  ctx.save();
  ctx.beginPath(); ctx.arc(c, c, ring === 'none' ? s * 0.5 : inner, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  if (!transparentBg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, s, s); }
  if (img) ctx.drawImage(img, 0, 0, s, s);
  ctx.restore();
  drawRing(ctx, s, ring, color);
}
