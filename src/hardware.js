// Driver check: only informs, never installs or updates.
// AMD ROCm on Windows (used by the upcoming AI features) needs Adrenalin 26.1.1 (January 2026) or newer.
export const AMD_MIN_DRIVER_DATE = '2026-01-06';
export const AMD_DRIVER_URL = 'https://www.amd.com/en/support/download/drivers.html';

export function assessGpu(g) {
  const name = String(g?.name || '');
  const isAmd = /amd|radeon/i.test(name);
  const isNvidia = /nvidia|geforce|rtx|quadro/i.test(name);
  let status = 'unknown';
  if (isAmd && g.driverDate) status = g.driverDate.slice(0, 10) >= AMD_MIN_DRIVER_DATE ? 'ok' : 'old';
  else if (isNvidia) status = 'ok';
  return { ...g, vendor: isAmd ? 'amd' : isNvidia ? 'nvidia' : 'other', status };
}

export function primaryGpu(info) {
  const list = (info?.gpus || []).map(assessGpu);
  return list.find(g => g.vendor === 'amd' || g.vendor === 'nvidia') || list[0] || null;
}
