// Tests the AI service against a mock ComfyUI server and a local file server (no GPU needed).
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const assert = require('assert'); const { execFileSync } = require('child_process');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aitest-'));
const sent = [];
const Module = require('module'); const orig = Module._load;
Module._load = function (r, ...a) {
  if (r === 'electron') return { app: { getPath: () => tmp, isPackaged: false, on() {} }, ipcMain: { handle() {} }, dialog: {}, shell: {} };
  return orig.call(this, r, ...a);
};
const KNOWN = new Set(['UNETLoader', 'CLIPLoader', 'VAELoader', 'ModelSamplingAuraFlow', 'CLIPTextEncode', 'ConditioningZeroOut', 'KSampler', 'VAEDecode', 'SaveImage', 'EmptySD3LatentImage', 'LoadImage', 'ImageScale', 'VAEEncode', 'RepeatLatentBatch']);
const png = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png'));
let lastPrompt = null; let uploads = 0;
const comfy = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/system_stats') return res.end(JSON.stringify({ system: { os: 'mock' }, devices: [{ name: 'mock gpu' }] }));
  if (u.pathname === '/upload/image') { uploads++; req.resume(); return req.on('end', () => res.end(JSON.stringify({ name: 'ascandir_init.png' }))); }
  if (u.pathname === '/prompt') {
    let b = ''; req.on('data', d => b += d); return req.on('end', () => {
      const { prompt } = JSON.parse(b);
      for (const [id, n] of Object.entries(prompt)) {
        assert.ok(KNOWN.has(n.class_type), 'unknown node ' + n.class_type);
        for (const v of Object.values(n.inputs)) if (Array.isArray(v)) assert.ok(prompt[v[0]], `node ${id} links to missing ${v[0]}`);
      }
      lastPrompt = prompt; res.end(JSON.stringify({ prompt_id: 'p1' }));
    });
  }
  if (u.pathname === '/history/p1') {
    const batch = lastPrompt[13].inputs.batch_size || lastPrompt[42]?.inputs.amount || 1;
    return res.end(JSON.stringify({ p1: { status: { completed: true, status_str: 'success' }, outputs: { 9: { images: Array.from({ length: batch }, (_, i) => ({ filename: 'a' + i + '.png', subfolder: 'ascandir', type: 'output' })) } } } }));
  }
  if (u.pathname === '/view') { res.setHeader('Content-Type', 'image/png'); return res.end(png); }
  res.statusCode = 404; res.end();
});
// file server with Range support
const big = Buffer.alloc(3_000_000, 7);
let failOnce = true;
const files = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let data = u.pathname.endsWith('.7z') ? fs.readFileSync(path.join(tmp, 'pkg.7z')) : big;
  const range = /bytes=(\d+)-/.exec(req.headers.range || '');
  if (range) { const s = Number(range[1]); res.writeHead(206, { 'Content-Length': data.length - s }); return res.end(data.subarray(s)); }
  res.writeHead(200, { 'Content-Length': data.length });
  if (u.pathname.includes('qwen') && failOnce) { failOnce = false; res.write(data.subarray(0, 1_000_000)); return res.destroy(); } // simulate broken connection
  res.end(data);
});

(async () => {
  await new Promise(r => comfy.listen(0, r)); await new Promise(r => files.listen(0, r));
  process.env.ACE_COMFY_PORT = String(comfy.address().port); process.env.ACE_AI_TEST = '1';
  const ai = require('../electron/ai.cjs');
  // 1) generation, text-to-image with 4 variants
  let r = await ai._test.generate({ prompt: 'test', seed: 5, width: 832, height: 1216, batch: 4 });
  assert.equal(r.images.length, 4); assert.ok(r.images[0].startsWith('data:image/png;base64,'));
  assert.equal(lastPrompt[13].class_type, 'EmptySD3LatentImage');
  // 2) refine (img2img)
  r = await ai._test.generate({ prompt: 'test', seed: 6, width: 832, height: 1216, batch: 2, initImage: 'data:image/png;base64,' + png.toString('base64'), denoise: 0.45 });
  assert.equal(r.images.length, 2); assert.equal(uploads, 1); assert.equal(lastPrompt[3].inputs.denoise, 0.45); assert.equal(lastPrompt[13].class_type, 'VAEEncode');
  console.log('generate ok');
  // 3) install: package (7z) + model files with resume after a broken download
  const sevenZ = require('7zip-bin').path7za;
  const pkg = path.join(tmp, 'pkgsrc', 'ComfyUI_windows_portable_amd');
  fs.mkdirSync(path.join(pkg, 'python_embeded'), { recursive: true }); fs.mkdirSync(path.join(pkg, 'ComfyUI'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'ComfyUI', 'main.py'), '#'); fs.writeFileSync(path.join(pkg, 'run_amd_gpu.bat'), '.\\python_embeded\\python.exe -s ComfyUI\\main.py --windows-standalone-build\npause\n');
  execFileSync(sevenZ, ['a', path.join(tmp, 'pkg.7z'), pkg], { stdio: 'ignore' });
  const base = `http://127.0.0.1:${files.address().port}/`;
  fs.writeFileSync(path.join(tmp, 'catalog.json'), '');
  ai.DEFAULT_CATALOG.comfy.amd = base + 'ComfyUI_windows_portable_amd.7z';
  ai.DEFAULT_CATALOG.models[0].files = ai.DEFAULT_CATALOG.models[0].files.map(f => ({ ...f, url: base + path.basename(f.dest) }));
  global.fetch = ((f) => (url, o) => (String(url).includes('ai-catalog.json') || String(url).includes('api.github.com') ? Promise.reject(new Error('offline')) : f(url, o)))(global.fetch);
  const dir = path.join(tmp, 'Ascandir-AI');
  let firstErr = null;
  try { await ai._test.install({ dir, gpu: 'amd', models: ['z-image-turbo'] }); } catch (e) { firstErr = e.message; }
  console.log('first install attempt:', firstErr || 'ok');
  await ai._test.install({ dir, gpu: 'amd', models: ['z-image-turbo'], comfy: false });
  const root = path.join(dir, 'ComfyUI_windows_portable_amd');
  assert.ok(fs.existsSync(path.join(root, 'ComfyUI', 'main.py')));
  for (const f of ai.DEFAULT_CATALOG.models[0].files) {
    const p = path.join(root, 'ComfyUI', f.dest);
    assert.ok(fs.existsSync(p), 'missing ' + f.dest); assert.equal(fs.statSync(p).size, big.length, 'size ' + f.dest);
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(tmp, 'ai-config.json'), 'utf8'));
  assert.ok(cfg.setupDone); assert.equal(cfg.models['z-image-turbo'].version, '1');
  console.log('install + resume ok');
  comfy.close(); files.close();
  console.log('ALL AI TESTS PASSED'); process.exit(0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
