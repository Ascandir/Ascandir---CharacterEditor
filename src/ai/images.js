import { MULTI_SIZE } from './prompt.js';

export async function toImg(src) { const i = new Image(); i.src = src; await i.decode(); return i; }

// split a sheet into its views, each trimmed to its content and padded to a square (good input for TRELLIS)
export async function splitViews(dataUrl, views = MULTI_SIZE.views) {
  const img = await toImg(dataUrl); const W = img.naturalWidth, H = img.naturalHeight; const slot = Math.floor(W / views);
  const out = [];
  for (let i = 0; i < views; i++) {
    const c = document.createElement('canvas'); c.width = slot; c.height = H;
    const x = c.getContext('2d'); x.drawImage(img, -slot * i, 0);
    const px = x.getImageData(0, 0, slot, H).data;
    let x0 = slot, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let k = 0; k < slot; k++) if (px[(y * slot + k) * 4 + 3] > 24) { if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = slot - 1; y1 = H - 1; }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.round(Math.max(bw, bh) * 1.1);
    const o = document.createElement('canvas'); o.width = o.height = side;
    o.getContext('2d').drawImage(c, x0, y0, bw, bh, Math.round((side - bw) / 2), Math.round((side - bh) / 2), bw, bh);
    out.push(o.toDataURL('image/png'));
  }
  return out;
}


// pad any picture to a centred square (TRELLIS input)
export async function padSquare(dataUrl) {
  const img = await toImg(dataUrl); const w = img.naturalWidth, h = img.naturalHeight;
  const side = Math.round(Math.max(w, h) * 1.05);
  const c = document.createElement('canvas'); c.width = c.height = side;
  c.getContext('2d').drawImage(img, Math.round((side - w) / 2), Math.round((side - h) / 2));
  return c.toDataURL('image/png');
}
