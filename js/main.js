/* mf-tod-bandit main (jsPsych v8 UMD)
   - インストラクション: 静的「確率折れ線」デモ + 実画面を模した遷移（選択→FB→ITI）
   - 目的意識の明示（課題全体の報酬最大化）
   - キー操作のみ（F=左 / J=右）
   - 環境RW＆報酬サンプルは「朝/晩/被験者」でシード分離
   - Firebase保存（失敗時はCSVフォールバック）
*/

const CONFIG = {
  N_TRIALS: 400,           // 本試行
  INSTR_PRACTICE_N: 10,    // instruction セッションの練習試行（0で説明のみは 0）
  STEP: 0.03,              // 環境RW幅（反射境界 0.25–0.75）
  ACK_MS: 250,             // 選択確認(ACK)
  FEEDBACK_MS: 700,        // フィードバック
  ITI_MS: 400,             // ITI
  COUNTERBALANCE_BY_PID: false, // PIDで○/△の左右を入替
  DEMO_POINTS: 80,         // デモ折れ線（静的）
  DEMO_STEP: 0.025
};

// --- URL パラメータ・セッション種別 ---
const RAW_SESSION = (getParam('session','morning')||'').toLowerCase();
const SESSION = (['instr','instruction','instructions'].includes(RAW_SESSION)) ? 'instruction' : RAW_SESSION;
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 試行数
const TOTAL_TRIALS = (SESSION === 'instruction') ? CONFIG.INSTR_PRACTICE_N : CONFIG.N_TRIALS;

// 乱数（セッションごとに分離）
const rngEnv = makeRng(`env:${PID}:${SESSION}`); // 環境RW
const rngRew = makeRng(`rew:${PID}:${SESSION}`); // 報酬サンプル

// 環境確率（本番用）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

/* ==== 刺激（図形） ==== */
function svgCircle(){ return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="circle"><circle cx="60" cy="60" r="40" stroke="currentColor" stroke-width="8" fill="none"/></svg>`; }
function svgTriangle(){ return `<svg viewBox="0 0 120 120" width="120" height="120" aria-label="triangle"><polygon points="60,20 100,100 20,100" stroke="currentColor" stroke-width="8" fill="none"/></svg>`; }
function pidParity(pid){ let s=0; for(let i=0;i<pid.length;i++) s=(s+pid.charCodeAt(i))&0xffff; return s%2; }
const STIM_MAP = (() => {
  const swap = CONFIG.COUNTERBALANCE_BY_PID && pidParity(PID)===1;
  return swap ? { left: 'triangle', right: 'circle' } : { left: 'circle', right: 'triangle' };
})();
function svgFor(side){ return (STIM_MAP[side] === 'circle') ? svgCircle() : svgTriangle(); }
function stimBlockHTML(side, selected=false){
  const labelTop = (side==='left')?'左':'右';
  const keyLabel = (side==='left')?'F':'J';
  const selClass = selected ? ' selected' : '';
  const ack = selected ? `<div class="ackmark" aria-hidden="true">✓</div>` : '';
  return `
    <div class="col">
      <div class="stim-box${selClass}">
        ${svgFor(side)}
        ${ack}
      </div>
      <div class="stim-label">${labelTop}（${keyLabel}）</div>
    </div>
  `;
}

/* ==== 静的・折れ線デモ ==== */
function reflect(v, lo, hi){ if(v<lo) v=lo+(lo-v); if(v>hi) v=hi-(v-hi); return Math.max(lo, Math.min(hi, v)); }
function genDemoSeries(session, n){
  const rng = makeRng(`demo:${session}`); // 朝晩で別系列
  const lo=0.25, hi=0.75, step=CONFIG.DEMO_STEP;
  let l=0.30, r=0.70;
  const L=[l], R=[r];
  for(let i=1;i<n;i++){
    const s = (rng()<0.5 ? -step : step);
    l = reflect(l + s, lo, hi);
    r = reflect(r - s, lo, hi);
    const gap = Math.abs(l-r);
    if (gap < 0.12){
      if (l < r) { l = Math.max(lo, l - 0.01); r = Math.min(hi, r + 0.01); }
      else       { r = Math.max(lo, r - 0.01); l = Math.min(hi, l + 0.01); }
    }
    L.push(l); R.push(r);
  }
  return {L,R};
}
function buildDemoChartHTML(series){
  const plotW=600, yTop=20, yBot=200, lo=0.25, range=0.5;
  const yMap = (p)=> { const t=(p-lo)/range; return yBot - t*(yBot-yTop); };
  const N = series.L.length;
  const ptsL=[], ptsR=[];
  for(let i=0;i<N;i++){
    const x = (i/Math.max(1,N-1))*plotW;
    ptsL.push(`${x},${yMap(series.L[i]).toFixed(2)}`);
    ptsR.push(`${x},${yMap(series.R[i]).toFixed(2)}`);
  }
  return `
    <div class="chart-wrap">
      <svg id="probDemo" viewBox="0 0 680 260" aria-label="probability demo line chart">
        <g transform="translate(56,16)">
          <g class="grid">
            <line x1="0" y1="20"  x2="${plotW}" y2="20"></line>
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
        <span class="swatchL"></span><span>左（${STIM_MAP.left==='circle'?'○':'△'}）</span>
        <span class="swatchR"></span><span>右（${STIM_MAP.right==='circle'?'○':'△'}）</span>
      </div>
    </div>
  `;
}

/* ==== ライブラリ確認 & Firebase ==== */
function libsReady(){
  return (typeof initJsPsych === 'function'
       && typeof jsPsychHtmlKeyboardResponse === 'function'
       && typeof jsPsychInstructions === 'function');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!libsReady()){
    const el = document.getElementById('jspsych-target');
    if (el){
      el.innerHTML = '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。</p></div>';
    }
    return;
  }

  const fbInit = (typeof initFirebase === 'function') ? initFirebase() : { ok:false };
  const USE_FIREBASE = !!fbInit.ok;

  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: async () => {
      const total = rows.reduce((s,r)=>s+(r.reward||0),0);
      const payload = { pid: PID, session: SESSION, total, n: TOTAL_TRIALS, trials: rows };
      let msg = '';
      try{
        if (USE_FIREBASE) {
          const id = await saveToFirebase(payload);
          msg = `<div class="small">Firebase に保存しました（id: <code>${id}</code>）。</div>`;
        } else {
          throw new Error('Firebase not available');
        }
      }catch(e){
        const csv = toCSV(rows);
        download(`bandit_${PID}_${SESSION}.csv`, csv);
        msg = `<div class="small">Firebase 未使用（または保存に失敗）につき CSV をダウンロードしました。<br>error: ${String(e)}`;
      }

      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>${SESSION==='instruction' ? 'インストラクション完了' : '終了'}</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${TOTAL_TRIALS}</span></p>
          ${msg}
          <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
        </div>`;
    }
  });

  // --- Instruction pages ---
  const demoHTML = buildDemoChartHTML(genDemoSeries(SESSION, CONFIG.DEMO_POINTS));

  // ① 概要
  const pageIntro =
    (SESSION === 'instruction'
      ? `<h2>インストラクション</h2>
         <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
         <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
         <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`
      : `<h2>2アーム課題</h2>
         <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
         <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
         <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`);

  // ② 目的意識（新規追加）
  const pagePurpose =
    `<h3>この課題の目的</h3>
     <p>どちらの選択肢が<b>より当たりやすい</b>かを試行を通して<b>学習</b>し、</p>
     <p><b>課題全体</b>で獲得できる<b>報酬（当たり=1）を最大化</b>することを目指してください。</p>
     <p class="small">各アームの当たり確率は時々刻々と変化します。過去の結果を手掛かりに、より期待値の高い選択を続けるのがポイントです。終了時に<b>合計スコア</b>が表示されます。</p>`;

  // ③ 確率デモ（静的）
  const pageDemo =
    `<p>当たり確率（0.25–0.75）は、下のように<b>ゆっくり変動</b>します（デモ）。</p>
     ${demoHTML}
     <p class="small" style="margin-top:6px;">※ 本番では確率は表示されません。朝/夜セッションでは<b>異なる擬似乱数系列</b>が用いられます。</p>`;

  // ④ 模擬：選択画面（F/J案内・このページは「次へ」で遷移）
  const pageMockChoice =
    `<div class="mock-title">【模擬】選択画面</div>
     <div class="small">実際の課題では <b>F=左 / J=右</b> で即時に選択が確定します。</div>
     <div class="choice-row" style="gap:96px; margin-top:16px;">
       ${stimBlockHTML('left')}
       ${stimBlockHTML('right')}
     </div>
     <div class="mock-note">※ 本インストラクションでは<b>ボタン（次へ）</b>で遷移します。</div>`;

  // ⑤ 模擬：フィードバック画面（duration は文言で）
  const pageMockFeedback =
    `<div class="mock-title">【模擬】フィードバック画面</div>
     <div class="jspsych-content"><div class="feedback win">✓ +1</div></div>
     <div class="mock-note">実際の課題では <b>約 ${CONFIG.FEEDBACK_MS}ms</b> 提示されます。</div>`;

  // ⑥ 模擬：ITI 画面（空白・duration は文言で）
  const pageMockITI =
    `<div class="mock-title">【模擬】ITI（休止）</div>
     <div class="mock-blank">（空白）</div>
     <div class="mock-note">実際の課題では <b>約 ${CONFIG.ITI_MS}ms</b> の空白画面が表示されます。</div>`;

  // ⑦ ここから本試行の案内
  const pageReady =
    `<p>${SESSION === 'instruction'
        ? `このセッションの練習試行数は <b>${TOTAL_TRIALS}</b> です。`
        : `このセッションは <b>${TOTAL_TRIALS}</b> 試行です。`
      }</p>
     <p>準備ができたら「次へ」を押してください（本番では選択後に自動で画面が切り替わります）。</p>`;

  const instructions = {
    type: jsPsychInstructions,
    pages: [pageIntro, pagePurpose, pageDemo, pageMockChoice, pageMockFeedback, pageMockITI, pageReady],
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // --- Trial (keyboard only) ---
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
        <div class="small" style="margin-top:16px;">キーで選択してください（<b>F=左 / J=右</b>）</div>
      `,
      choices: ['f','j'],
      response_ends_trial: true,
      on_finish: (data) => {
        const key = String(data.response || '').toLowerCase();
        const choice = (key === 'f') ? 'L' : 'R';
        const pChosen = (choice==='L') ? pL : pR;

        const reward = (rngRew() < pChosen) ? 1 : 0;

        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3),
          stim_left: STIM_MAP.left, stim_right: STIM_MAP.right
        });

        pL = rwStepSeed(pL, CONFIG.STEP, rngEnv);
        pR = rwStepSeed(pR, CONFIG.STEP, rngEnv);

        data.__choice = choice;
        data.__fb_text  = reward ? '✓ +1' : '× 0';
        data.__fb_class = reward ? 'win'   : 'lose';
      }
    };
  }

  const timeline = [instructions];

  for (let t=0; t<TOTAL_TRIALS; t++){
    // 選択
    timeline.push(trialFactory(t));

    // ACK
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const ch = last.__choice || 'L';
        const lSel = (ch === 'L'), rSel = (ch === 'R');
        return `
          <div class="choice-row" style="gap:96px; margin-top:18px;">
            ${stimBlockHTML('left', lSel)}
            ${stimBlockHTML('right', rSel)}
          </div>
          <div class="small" style="margin-top:8px;">選択を確認中…</div>
        `;
      },
      choices: "NO_KEYS",
      trial_duration: CONFIG.ACK_MS
    });

    // フィードバック
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(2).values()[0] || {};
        const txt = last.__fb_text || '';
        const cls = last.__fb_class || '';
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
