/* mf-tod-bandit main (jsPsych v8 UMD)
   - キーボードのみ（F=左, J=右）
   - 図形刺激（左=○ / 右=△；PID で左右入替オプション）
   - インストラクション：静的な折れ線デモ／1試行タイムライン説明
   - 本番：朝/晩で擬似乱数シードを切替（環境RW・報酬サンプル）
*/

const CONFIG = {
  N_TRIALS: 400,
  STEP: 0.03,            // 環境確率ランダムウォーク幅（反射境界 0.25–0.75）
  FEEDBACK_MS: 700,      // フィードバック表示
  ITI_MS: 400,           // ITI（空白）
  INSTR_PRACTICE_N: 10,  // インストラクション練習試行（0で説明のみ）
  COUNTERBALANCE_BY_PID: false,

  // 静的デモ（折れ線）
  DEMO_POINTS: 80,
  DEMO_STEP: 0.025
};

// --- URL パラメータとセッション解釈 ---
const RAW_SESSION = (getParam('session','morning')||'').toLowerCase();
const SESSION = (['instr','instruction','instructions'].includes(RAW_SESSION)) ? 'instruction' : RAW_SESSION;
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);
const TOTAL_TRIALS = (SESSION === 'instruction') ? CONFIG.INSTR_PRACTICE_N : CONFIG.N_TRIALS;

// --- セッション依存シード（朝/晩で系列を変える） ---
const rngEnv = makeRng(`env:${PID}:${SESSION}`); // 環境RW
const rngRew = makeRng(`rew:${PID}:${SESSION}`); // 報酬サンプル

// --- 環境確率（左右独立のRW; 初期0.5） ---
let pL = 0.5, pR = 0.5;

// --- ログ ---
const rows = [];

/* ========= 図形刺激 ========= */
function svgCircle(){
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="circle" role="img">
    <circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="8" fill="none" />
  </svg>`;
}
function svgTriangle(){
  return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="triangle" role="img">
    <polygon points="60,20 100,100 20,100" stroke="currentColor" stroke-width="8" fill="none" />
  </svg>`;
}

// PID で左右入替（任意）
function pidParity(pidStr){ let s=0; for(let i=0;i<pidStr.length;i++) s=(s+pidStr.charCodeAt(i))&0xffff; return s%2; }
const STIM_MAP = (() => {
  const swap = CONFIG.COUNTERBALANCE_BY_PID && pidParity(PID) === 1;
  return swap ? { left:'triangle', right:'circle' } : { left:'circle', right:'triangle' };
})();
function svgFor(side){ return (STIM_MAP[side]==='circle') ? svgCircle() : svgTriangle(); }

function stimBlockHTML(side){
  const label = (side==='left') ? '左（F）' : '右（J）';
  return `
    <div class="col">
      <div class="stim-box">${svgFor(side)}</div>
      <div class="stim-label">${label}</div>
    </div>`;
}

/* ========= 静的デモ：確率折れ線 ========= */
function reflect(v, lo, hi){
  if (v < lo) v = lo + (lo - v);
  if (v > hi) v = hi - (v - hi);
  return Math.max(lo, Math.min(hi, v));
}

/** 乖離が分かりやすい左右反相関のRW系列を生成（0.25–0.75, 長さ n） */
function genDemoSeries(session, n){
  const rng = makeRng(`demo:${session}`);
  const lo=0.25, hi=0.75, step=CONFIG.DEMO_STEP;
  let l=0.30, r=0.70;
  const L=[l], R=[r];
  for (let i=1;i<n;i++){
    const s = (rng()<0.5 ? -step : step);
    l = reflect(l + s, lo, hi);
    r = reflect(r - s, lo, hi);
    const gap = Math.abs(l - r);
    if (gap < 0.12){
      if (l < r){ l = Math.max(lo, l - 0.01); r = Math.min(hi, r + 0.01); }
      else      { r = Math.max(lo, r - 0.01); l = Math.min(hi, l + 0.01); }
    }
    L.push(l); R.push(r);
  }
  return {L, R};
}

/** series->{L,R} を SVG 折れ線にして返す */
function buildDemoChartHTML(series){
  const plotW=600, plotH=200, padL=56, padT=16;
  const yTop=20, yBot=200, lo=0.25, range=0.5;
  const yMap = (p)=>{ const t=(p-lo)/range; return yBot - t*(yBot-yTop); };
  const N = series.L.length;
  const ptsL=[], ptsR=[];
  for(let i=0;i<N;i++){
    const x = (i / Math.max(1,N-1)) * plotW;
    ptsL.push(`${x},${yMap(series.L[i]).toFixed(2)}`);
    ptsR.push(`${x},${yMap(series.R[i]).toFixed(2)}`);
  }
  return `
    <div class="chart-wrap">
      <svg id="probDemo" viewBox="0 0 680 260" role="img" aria-label="probability demo line chart">
        <g transform="translate(${padL},${padT})">
          <g class="grid">
            <line x1="0" y1="20" x2="${plotW}" y2="20"></line>
            <line x1="0" y1="110" x2="${plotW}" y2="110"></line>
            <line x1="0" y1="${yBot}" x2="${plotW}" y2="${yBot}"></line>
          </g>
          <text class="axisLabel" x="-8" y="24"  text-anchor="end">0.75</text>
          <text class="axisLabel" x="-8" y="114" text-anchor="end">0.50</text>
          <text class="axisLabel" x="-8" y="${yBot+4}" text-anchor="end">0.25</text>

          <polyline class="lineL" points="${ptsL.join(' ')}"></polyline>
          <polyline class="lineR" points="${ptsR.join(' ')}"></polyline>

          <line class="grid" x1="0" y1="${yBot}" x2="${plotW}" y2="${yBot}"></line>
        </g>
      </svg>
      <div class="legend">
        <span class="swatchL" aria-hidden="true"></span><span>左（${STIM_MAP.left==='circle'?'○':'△'}）</span>
        <span class="swatchR" aria-hidden="true"></span><span>右（${STIM_MAP.right==='circle'?'○':'△'}）</span>
      </div>
    </div>`;
}

/* ========= ライブラリ確認 ========= */
function libsReady(){
  return (typeof initJsPsych === 'function' &&
          typeof jsPsychHtmlKeyboardResponse === 'function' &&
          typeof jsPsychInstructions === 'function');
}

/* ========= メイン ========= */
document.addEventListener('DOMContentLoaded', () => {
  if (!libsReady()){
    const el = document.getElementById('jspsych-target');
    if (el){
      el.innerHTML = '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。CDN URL / ネットワーク / 拡張機能を確認してください。</p></div>';
    }
    return;
  }

  // インストラクションのページ群（※ 先に定義）
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

    // 静的・折れ線デモ
    `<p>当たり確率（0.25–0.75）は下のように<b>ゆっくり変動</b>します（デモ）。</p>
     ${demoHTML}
     <p class="small" style="margin-top:6px;">※ 本番では確率は表示されません。朝/夜セッションでは<b>異なる擬似乱数系列</b>が用いられます。</p>`,

    // 1試行のタイムライン
    `<h3>1試行のタイムライン</h3>
     <div class="flow">
       <div class="flow-item"><div class="flow-title">選択</div><div class="flow-desc">F=左 / J=右</div></div>
       <div class="flow-arrow">→</div>
       <div class="flow-item"><div class="flow-title">報酬提示</div><div class="flow-desc">✓ +1 / × 0（約 ${CONFIG.FEEDBACK_MS} ms）</div></div>
       <div class="flow-arrow">→</div>
       <div class="flow-item"><div class="flow-title">ITI</div><div class="flow-desc">空白画面（約 ${CONFIG.ITI_MS} ms）</div></div>
     </div>
     <p>準備ができたら「次へ」を押してください。</p>`,

    // 試行数の案内
    (SESSION === 'instruction'
      ? `<p>このセッションの<b>練習試行</b>は <b>${TOTAL_TRIALS}</b> です（0 なら説明のみ）。</p>`
      : `<p>このセッションは <b>${TOTAL_TRIALS}</b> 試行です。</p>`
    )
  ];

  // ←←← ここで instructions を定義してから使う
  const instructions = {
    type: jsPsychInstructions,
    pages,
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // jsPsych 初期化
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

  // 1試行（F/J キー）
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
        const choice = (key==='f') ? 'L' : 'R';
        const pChosen = (choice==='L') ? pL : pR;

        // セッション依存の乱数で報酬サンプル
        const reward = (rngRew() < pChosen) ? 1 : 0;

        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3),
          stim_left: STIM_MAP.left, stim_right: STIM_MAP.right
        });

        // 環境確率を更新（セッション依存シード）
        pL = rwStepSeed(pL, CONFIG.STEP, rngEnv);
        pR = rwStepSeed(pR, CONFIG.STEP, rngEnv);

        data.__fb_txt = reward ? '✓ +1' : '× 0';
        data.__fb_cls = reward ? 'win' : 'lose';
      }
    };
  }

  // タイムライン
  const timeline = [];
  timeline.push(instructions);

  for (let t=0; t<TOTAL_TRIALS; t++){
    timeline.push(trialFactory(t));
    // フィードバック
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const txt = last.__fb_txt || '';
        const cls = last.__fb_cls || '';
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
