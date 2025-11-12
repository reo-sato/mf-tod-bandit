// js/utils.js
function getParam(name, defaultValue = null){
  const params = new URLSearchParams(window.location.search);
  return params.has(name) ? params.get(name) : defaultValue;
}

// 反射境界付きランダムウォーク（0.25–0.75）
export function rwStep(p, step){
  const s = Math.random() < 0.5 ? -step : step;
  let v = p + s;
  const lo = 0.25, hi = 0.75;
  if (v < lo) v = lo + (lo - v);
  if (v > hi) v = hi - (v - hi);
  return Math.max(lo, Math.min(hi, v));
}

export function toCSV(rows){
  const esc = (v)=>`"${String(v).replace(/"/g,'""')}"`;
  const header = Object.keys(rows[0]);
  const lines = [header.map(esc).join(",")];
  for(const r of rows){ lines.push(header.map(k=>esc(r[k] ?? "")).join(",")); }
  return lines.join("\n");
}

export function download(filename, text){
  const blob = new Blob([text], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
