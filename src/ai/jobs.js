// Global state of long running AI jobs (painting, 3D), so they survive switching tabs and show in the top bar.
import { useSyncExternalStore } from 'react';
import { api } from '../platform.js';

let state = { paint: null, model3d: null, done: null };
const subs = new Set();
const emit = () => subs.forEach(f => f());
export function setJob(kind, v) {
  const prev = state[kind];
  if (!prev && v && typeof v !== 'function') state = { ...state, done: null }; // a new job replaces the old result
  const next = typeof v === 'function' ? v(prev) : v;
  state = { ...state, [kind]: next };
  emit();
}
export function finishJob(kind, ok, msg) {
  // the result stays visible in the top bar until it is clicked or dismissed (a cancelled job just disappears)
  state = { ...state, [kind]: null, done: msg === 'CANCELLED' ? state.done : { kind, ok, msg, at: Date.now(), seconds: state[kind]?.seconds } };
  emit();
}
export function dismissDone() { state = { ...state, done: null }; emit(); }
export function useJobs() { return useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, () => state); }
export function useJob(kind) {
  const s = useJobs();
  return [s[kind], (v) => setJob(kind, v)];
}
export function cancelJob(kind) {
  setJob(kind, j => (j ? { ...j, cancelling: true } : j));
  if (kind === 'paint') api.ai.cancelGen?.(); else api.trellis.cancel?.();
}
// seconds come from the main process
let wired = false;
export function wireJobs() {
  if (wired) return; wired = true;
  api.ai.on?.('ai:gen', g => setJob('paint', j => (j ? { ...j, seconds: g.seconds } : j)));
  api.trellis.on?.('trellis:gen', g => setJob('model3d', j => (j ? { ...j, seconds: g.seconds } : j)));
}
export const fmtTime = (s) => `${Math.floor((s || 0) / 60)}:${String((s || 0) % 60).padStart(2, '0')}`;
