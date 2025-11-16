/* mf-tod-bandit main (v8 UMD, keyboard only)
   - インストラクション内に静的「折れ線デモ」を挿入（アニメ無し）
   - 朝/晩 で異なるシードの擬似乱数系列（環境RW＆報酬サンプル）
   - 図形刺激（左=○/右=△；PIDベースの左右入替オプションあり）
*/

const CONFIG = {
  N_TRIALS: 400,          // 本試行
  STEP: 0.03,             // 環境確率ランダムウォーク幅（本番）
  FEEDBACK_MS: 700,       // 結果フィードバック表示（ms）
  ITI_MS: 400,            // インタートライアル（ms）
  INSTR_PRACTICE_N: 10,   // インストラクション時の練習試行（0なら説明のみ）
  COUNTERBALANCE_BY_PID: false, // true: PIDに応じて ○/△ を左右入替

  // デモ用折れ線（静的に描画）
  DEMO_POINTS: 80,        // 折れ線の点数（横方向の解像度）
  DEMO_STEP: 0.025        // デモ内のRW幅（大きめで「乖離」を保ちやすく）
};

// --- URL パラメータ ---
const RAW_SESSION = (getParam('session','morning')||'').toLowerCase();
const SESSION = (['instr','instruction','instructions'].includes(RAW_SESSION))
  ? 'instruction'
  : RAW_SESSION;
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 実行試行数
const TOTAL_TRIALS = (SESSION === 'instruction') ? CONFIG.INSTR_PRACTICE_N : CONFIG.N_TRIALS;

// ---- 擬似乱数（朝晩でシードを変える） ----
const rngEnv = makeRng(`env:${PID}:${SESSION}`); // 環境RW用
const rngRew = makeRng(`rew:${PID}:${SESSION}`); // 報酬サンプル用

// 環境確率（左右独立；本番用, 初期0.5）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

/* ---------- 刺激（図形） ---------- */
function svgCircle() {
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="circle" role="img">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="8" fill="none" />
  </svg>`;
}
function svgTriangle() {
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="triangle" role="img">
    <polygon points="60,20 100,100 20,100" stroke="currentColor" stroke-width="8" fill="none" />
  </svg>`;
}

// PID に基づく簡易カウンターバランス（任意）
function pidParity(pidStr) {
  let s = 0;
  for (let i=0;i<pidStr.length;i++) s = (s + pidStr.charCodeAt(i)) & 0xffff;
  return s % 2;
}
const STIM_MAP = (() => {
  const swap = CONFIG.COUNTERBALANCE_BY_PID && pidParity(PID) === 1;
  return swap ? { left: 'triangle', right: 'circle' }
              : { left: 'circle',  right: 'triangle' };
})();
function svgFor(side){ return (STIM_MAP[side] === 'circle') ? svgCircle() : svgTriangle(); }
function stimBlockHTML(side /* 'left'|'right' */, selected=false) {
  const labelTop = (side === 'left') ? '左' : '右';
  const keyLabel = (side === 'left') ? 'F' : 'J';
  const svg = svgFor(side);
  const selClass = selected ? ' selected' : '';
  const ack = selected ? `<div class="ackmark" aria-hidden="true">✓</div>` : '';
  return `
    <div class="col">
      <div class="stim-box${selClass}">
        ${svg}
        ${ack}
      </div>
      <div class="stim-label">${labelTop}（${keyLabel}）</div>
    </div>
  `;
}

/* ---------- 静的・折れ線デモ（アニメ無し） ---------- */
/** 乖離が分かりやすい 2系列（左右反相関）のRWを生成（0.25–0.75, 長さ n） */
function genDemoSeries(session, n){
  const rng = makeRng(`demo:${session}`); // 朝晩で異なるデモ系列
  const lo=0.25, hi=0.75, step=CONFIG.DEMO_STEP;
  let l=0.30, r=0.70; // スタートを乖離させる
  const L=[l], R=[r];

  for(let i=1;i<n;i++){
    // 反相関ステップで乖離を維持（ときどき弱ノイズを足して単調になりすぎないように）
    const s = (rng()<0.5 ? -step : step);
    l = reflect(l + s, lo, hi);
    r = reflect(r - s, lo, hi);

    // 乖離が狭まりすぎたら少し押し広げる（視覚説明用のヒューリスティック）
    const gap = Math.abs(l - r);
    if (gap < 0.12){
      if (l < r) { l = Math.max(lo, l - 0.01); r = Math.min(hi, r + 0.01); }
      else       { r = Math.max(lo, r - 0.01); l = Math.min(hi, l + 0.01); }
    }
    L.push(l); R.push(r);
  }
  return {L, R};
}
function reflect(v, lo, hi){
  if (v < lo) v = lo + (lo - v);
  if (v > hi) v = hi - (v - hi);
  return Math.max(lo, Math.min(hi, v));
}
/** series -> SVG 折れ線HTML（静的） */
function buildDemoChartHTML(series){
  const plotW=600, plotH=200, padL=56, padT=16; // viewBox変換後
  const yTop=20, yBot=200, lo=0.25, range=0.5;  // 0.25–0.75 を [200..20] に線形写像
  const yMap = (p)=> {
    const t = (p - lo) / range; // 0..1
    return yBot - t * (yBot - yTop);
  };
  const N = series.L.length;
  const ptsL=[], ptsR=[];
  for(let i=0;i<N;i++){
    const x = (i / Math.max(1, N-1)) * plotW;
    ptsL.push(`${x},${yMap(series.L[i]).toFixed(2)}`);
    ptsR.push(`${x},${yMap(series.R[i]).toFixed(2)}`);
  }
  return `
    <div class="chart-wrap">
      <svg id="probDemo" viewBox="0 0 680 260" role="img" aria-label="probability demo line chart">
        <g transform="translate(${padL},${padT})">
          <!-- グリッド -->
          <g class="grid">
            <line x1="0" y1="20"  x2="${plotW}" y2="20"></line>
            <line x1="0" y1="110" x2="${plotW}" y2="110"></line>
            <line x1="0" y1="${yBot}" x2="${plotW}" y2="${yBot}"></line>
          </g>
          <text class="axisLabel" x="-8" y="24"  text-anchor="end">0.75</text>
          <text class="axisLabel" x="-8" y="114" text-anchor="end">0.50</text>
          <text class="axisLabel" x="-8" y="${yBot+4}" text-anchor="end">0.25</text>
          <!-- 折れ線 -->
          <polyline class="lineL" points="${ptsL.join(' ')}"></polyline>
          <polyline class="lineR" points="${ptsR.join(' ')}"></polyline>
          <!-- x軸 -->
          <line class="grid" x1="0" y1="${yBot}" x2="${plotW}" y2="${yBot}"></line>
        </g>
      </svg>
      <div class="legend">
        <span class="swatchL" aria-hidden="true"></span><span>左（${STIM_MAP.left==='circle'?'○':'△'}）</span>
        <span class="swatchR" aria-hidden="true"></span><span>右（${STIM_MAP.right==='circle'?'○':'△'}）</span>
      </div>
    </div>
  `;
}

/* ---------- jsPsych ---------- */
function libsReady(){
  return (typeof initJsPsych === 'function' &&
          typeof jsPsychHtmlKeyboardResponse === 'function' &&
          typeof jsPsychInstructions === 'function');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!libsReady()){
    const el = document.getElementById('jspsych-target');
    if (el){
      el.innerHTML =
        '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。CDNのURL/ネットワーク/拡張機能（スクリプトブロッカー）を確認してください。</p></div>';
    }
    return;
  }

  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: () => {
      const total = rows.reduce((s,r)=>s+(r.reward||0),0);
      const csv = toCSV(rows);
      download(`bandit_${PID}_${SESSION}.csv`, csv);
      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>${SESSION==='instruction' ? 'インストラクション完了' : '終了'}</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${TOTAL_TRIALS}</span></p>
          <div class="small">CSV をダウンロードしました。</div>
          <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
        </div>`;
    }
  });

  // --- インストラクション（静的・折れ線ページを挿入） ---
  const demoSeries = genDemoSeries(SESSION, CONFIG.DEMO_POINTS);
  const demoHTML = buildDemoChartHTML(demoSeries);

  const pages = [
    (SESSION === 'instruction'
      ? `<h2>インストラクション</h2>
         <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
         <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
         <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`
      : `<h2>2アーム課題</h2>
         <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
         <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
         <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`
    ),

    // 静的 折れ線デモ（アニメなし、Next/Back で遷移）
    `<p>当たり確率（0.25–0.75）は、下のように<b>ゆっくり変動</b>します（デモ）。</p>
     ${demoHTML}
     <p class="small" style="margin-top:6px;">※ 本番では確率は表示されません。朝/夜セッションでは<b>異なる擬似乱数系列</b>が用いられます。</p>`,

    // 試行数の案内
    (SESSION === 'instruction'
      ? `<p>このセッションの練習試行数は <b>${TOTAL_TRIALS}</b> です（0 なら説明のみ）。</p>
         <p>準備ができたら「次へ」を押してください。</p>`
      : `<p>このセッションは <b>${TOTAL_TRIALS}</b> 試行です。</p>
         <p>準備ができたら「次へ」を押してください。</p>`
    )
  ];

  const instructions = {
    type: jsPsychInstructions,
    pages,
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // --- 1試行（キー押しのみ） ---
  function trialFactory(tIndex){
    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: () => `
        <div class="small">
          PID: ${PID} / Session: ${SESSION} / Trial ${tIndex+1}
          / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}
        </div>
        <div class="choice-row" style="gap:96px; margin-top:24px;">
          ${stimBlockHTML('left')}
          ${stimBlockHTML('right')}
        </div>
        <div class="small" style="margin-top:16px;">キーで選択してください（クリック不可）</div>
      `,
      choices: ['f','j'],
      response_ends_trial: true,
      on_finish: (data) => {
        const key = String(data.response || '').toLowerCase();
        const choice = (key === 'f') ? 'L' : 'R';
        const pChosen = (choice === 'L') ? pL : pR;

        // 報酬サンプルはセッション別シード
        const reward = (rngRew() < pChosen) ? 1 : 0;

        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3),
          stim_left: STIM_MAP.left, stim_right: STIM_MAP.right
        });

        // 環境RWもセッション別シードで更新
        pL = rwStepSeed(pL, CONFIG.STEP, rngEnv);
        pR = rwStepSeed(pR, CONFIG.STEP, rngEnv);

        data.__feedbackText = reward ? '✓ +1' : '× 0';
        data.__feedbackClass = reward ? 'win' : 'lose';
      }
    };
  }

  // --- タイムライン構築 ---
  const timeline = [instructions];

  for (let t=0; t<TOTAL_TRIALS; t++){
    // 選択
    timeline.push(trialFactory(t));
    // フィードバック
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const txt = last.__feedbackText || '';
        const cls = last.__feedbackClass || '';
        return `<div class="jspsych-content"><div class="feedback ${cls}">${txt}</div></div>`;
      },
      choices: "NO_KEYS",
      trial_duration: CONFIG.FEEDBACK_MS
    });
    // ITI
    if (CONFIG.ITI_MS > 0){
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div class="small"> </div>',
        choices: "NO_KEYS",
        trial_duration: CONFIG.ITI_MS
      });
    }
  }

  jsPsych.run(timeline);
});
