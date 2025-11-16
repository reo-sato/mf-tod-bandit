// URL parameter
function getParam(name, defaultValue=null){
  const params = new URLSearchParams(window.location.search);
  return params.has(name) ? params.get(name) : defaultValue;
}

// CSV
function toCSV(rows){
  if (!rows.length) return '';
  const esc = (v)=>`"${String(v).replace(/"/g,'""')}"`;
  const header = Object.keys(rows[0]);
  const lines = [header.map(esc).join(",")];
  for(const r of rows){ lines.push(header.map(k=>esc(r[k] ?? "")).join(",")); }
  return lines.join("\n");
}
function download(filename, text){
  const blob = new Blob([text], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

// Seeded PRNG
function _xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0; i<str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function _mulberry32(a){
  let t = a >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedStr){ const h = _xmur3(String(seedStr))(); return _mulberry32(h); }

// Reflecting RW (seeded; 0.25–0.75)
function rwStepSeed(p, step, rng){
  const s = (rng() < 0.5 ? -step : step);
  let v = p + s;
  const lo = 0.25, hi = 0.75;
  if (v < lo) v = lo + (lo - v);
  if (v > hi) v = hi - (v - hi);
  return Math.max(lo, Math.min(hi, v));
}
