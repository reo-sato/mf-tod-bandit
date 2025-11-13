// --- URL パラメータ取得 ---
function getParam(name, defaultValue = null){
  const params = new URLSearchParams(window.location.search);
  return params.has(name) ? params.get(name) : defaultValue;
}

// --- 反射境界付きランダムウォーク（0.25–0.75） ---
function rwStep(p, step){
  const s = Math.random() < 0.5 ? -step : step;
  let v = p + s;
  const lo = 0.25, hi = 0.75;
  if (v < lo) v = lo + (lo - v);   // reflect at lower bound
  if (v > hi) v = hi - (v - hi);   // reflect at upper bound
  return Math.max(lo, Math.min(hi, v));
}

// --- CSV 生成（配列の配列ではなく配列のオブジェクトを想定）---
function toCSV(rows){
  if (!rows || !rows.length) return "";
  const esc = (v)=>`"${String(v ?? "").replace(/"/g,'""')}"`;
  const header = Object.keys(rows[0]);
  const out = [header.map(esc).join(",")];
  for (const r of rows){
    out.push(header.map(k => esc(r[k])).join(","));
  }
  return out.join("\n");
}

// --- CSV ダウンロード ---
function download(filename, text){
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
