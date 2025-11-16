/* mf-tod-bandit main (v8 UMD, keyboard only, Firebase save)
   - 図形刺激で左右を視覚的に差別化（左=○ / 右=△）
   - セッション 'instruction'（または instr/instructions）に対応
   - 選択確認(ACK)を追加（中立チェックを短時間表示）
   - NEW: インストラクション内に「確率がゆっくり変動するデモ」を挿入（本番では非表示）
*/

const CONFIG = {
  N_TRIALS: 400,          // 本試行
  INSTR_PRACTICE_N: 10,   // インストラクション時の練習試行（0なら説明のみ）
  STEP: 0.03,             // 環境確率ランダムウォーク幅（本番）
  PROB_DEMO_MS: 5000,     // ★ 確率デモの表示時間（ms）
  PROB_DEMO_STEP: 0.025,  // ★ デモ用ランダムウォーク幅（見やすさ重視）
  ACK_MS: 250,            // 選択確認(ACK)の表示時間（ms）
  FEEDBACK_MS: 700,       // 結果フィードバック表示（ms）
  ITI_MS: 400,            // インタートライアル（ms）
  COUNTERBALANCE_BY_PID: false // true: PIDで○/△の左右を入替
};

// --- URL パラメータ ---
const RAW_SESSION = (getParam('session','morning')||'').toLowerCase();
const SESSION = (['instr','instruction','instructions'].includes(RAW_SESSION))
  ? 'instruction'
  : RAW_SESSION;
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 実行試行数
const TOTAL_TRIALS = (SESSION === 'instruction') ? CONFIG.INSTR_PRACTICE_N : CONFIG.N_TRIALS;

// 環境確率（左右独立；本番用）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

// 図形刺激（SVG：モノクロ・等輝度）
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
// 左右の図形を決める（既定：左○/右△）
const STIM_MAP = (() => {
  const swap = CONFIG.COUNTERBALANCE_BY_PID && pidParity(PID) === 1;
  return swap
    ? { left: 'triangle', right: 'circle' }
    : { left: 'circle', right: 'triangle' };
})();

function svgFor(side){ return (STIM_MAP[side] === 'circle') ? svgCircle() : svgTriangle(); }

// 図形ブロックHTML（selected=trueでACK用ハイライト＋中立チェック表示）
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

// ライブラリチェック
function libsReady(){
  return (typeof initJsPsych === 'function' &&
          typeof jsPsychHtmlKeyboardResponse === 'function' &&
          typeof jsPsychInstructions === 'function');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!libsReady()){
    console.error('jsPsych not loaded:', {
      initJsPsych: typeof initJsPsych,
      KeyResp: typeof jsPsychHtmlKeyboardResponse,
      Instr: typeof jsPsychInstructions
    });
    const el = document.getElementById('jspsych-target');
    if (el){
      el.innerHTML =
        '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。CDNのURL/ネットワーク/拡張機能（スクリプトブロッカー）を確認してください。</p></div>';
    }
    return;
  }

  // Firebase 初期化（config/ルール次第で保存、失敗時は CSV フォールバック）
  const fbInit = (typeof initFirebase === 'function') ? initFirebase() : { ok:false };
  const USE_FIREBASE = !!fbInit.ok;

  // jsPsych 初期化
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
        msg = `<div class="small">Firebase 未使用（または保存に失敗）につき CSV をダウンロードしました。<br>error: ${String(e)}</div>`;
      }

      const header = (SESSION === 'instruction') ? 'インストラクション完了' : '終了';
      const note   = (SESSION === 'instruction')
        ? '<p>本番セッション（morning / evening）は別URLで実行してください。</p>'
        : '';
      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>${header}</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${TOTAL_TRIALS}</span></p>
          ${msg}
          ${note}
          <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
        </div>`;
    }
  });

  // --- 説明スライド ---
  const introBody = (SESSION === 'instruction')
    ? `<h2>インストラクション</h2>
       <p>このセッションでは課題の説明と<b>短い練習</b>のみ行います。</p>
       <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
       <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`
    : `<h2>2アーム課題</h2>
       <p>左右の選択肢は<b>図形</b>（例：○と△）で表示され、<b>F=左 / J=右</b>で選択します。</p>
       <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`;

  const countLine = (SESSION === 'instruction')
    ? `<p>このセッションの練習試行数は <b>${TOTAL_TRIALS}</b> です（0 なら説明のみ）。</p>`
    : `<p>このセッションは <b>${TOTAL_TRIALS}</b> 試行です。</p>`;

  const pages = [
    introBody,
    `<p>下のように表示されます。</p>
     <div class="choice-row" style="justify-content:center;gap:96px;margin:24px 0;">
       ${stimBlockHTML('left')}
       ${stimBlockHTML('right')}
     </div>
     <p><b>F = 左</b>、<b>J = 右</b> で選択します。</p>
     <p>選択後は<b>短い確認画面</b>（中立色のチェック）が表示された後、結果（✓ +1 / × 0）が提示されます。</p>
     ${countLine}
     ${(SESSION==='instruction' && CONFIG.PROB_DEMO_MS>0)
       ? '<p>次の画面で「確率がゆっくり変化する様子」の<b>デモ</b>を数秒だけ表示します（本番では確率は表示されません）。</p>'
       : '<p>準備ができたら「次へ」を押してください。</p>'}`
  ];

  const instructions = {
    type: jsPsychInstructions,
    pages,
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // --- 確率デモ（instruction セッションのみ） ---
  const probDemoTrial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: function(){
      // デモ用UI（本番とは独立）
      return `
        <div class="small">確率が時間とともにゆっくり変化するデモ（本番では確率は非表示）</div>
        <div class="choice-row" style="gap:96px; margin-top:18px;">
          <div class="col">
            <div class="stim-box">${svgFor('left')}</div>
            <div class="prob-track"><div id="fillL" class="prob-fill" style="width:50%"></div></div>
            <div class="prob-label">デモ確率（左）: <span id="txtL">0.50</span></div>
          </div>
          <div class="col">
            <div class="stim-box">${svgFor('right')}</div>
            <div class="prob-track"><div id="fillR" class="prob-fill" style="width:50%"></div></div>
            <div class="prob-label">デモ確率（右）: <span id="txtR">0.50</span></div>
          </div>
        </div>
        <div class="small" style="margin-top:12px;">この画面は<b>デモ</b>です。数秒後に自動で次へ進みます。</div>
      `;
    },
    choices: "NO_KEYS",
    trial_duration: CONFIG.PROB_DEMO_MS,
    on_load: () => {
      // デモ用の独立 RW（本番の pL/pR と無関係）
      let dl = 0.5, dr = 0.5;
      const step = CONFIG.PROB_DEMO_STEP;
      const $fillL = document.getElementById('fillL');
      const $fillR = document.getElementById('fillR');
      const $txtL = document.getElementById('txtL');
      const $txtR = document.getElementById('txtR');

      function clamp(v){ return Math.max(0.25, Math.min(0.75, v)); }
      function stepOnce(v){
        const s = (Math.random()<0.5 ? -step : step);
        let nv = v + s;
        if (nv < 0.25) nv = 0.25 + (0.25 - nv);
        if (nv > 0.75) nv = 0.75 - (nv - 0.75);
        return clamp(nv);
      }

      window.__probDemoTimer = setInterval(()=>{
        dl = stepOnce(dl);
        dr = stepOnce(dr);
        if ($fillL) $fillL.style.width = `${Math.round(dl*100)}%`;
        if ($fillR) $fillR.style.width = `${Math.round(dr*100)}%`;
        if ($txtL) $txtL.textContent = dl.toFixed(2);
        if ($txtR) $txtR.textContent = dr.toFixed(2);
      }, 120);
    },
    on_finish: () => {
      if (window.__probDemoTimer){
        clearInterval(window.__probDemoTimer);
        delete window.__probDemoTimer;
      }
    }
  };

  // --- 1試行（キー押し） ---
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
        const reward = Math.random() < pChosen ? 1 : 0;

        rows.push({
          pid: PID,
          session: SESSION,
          trial: tIndex+1,
          choice,
          reward,
          rt: data.rt,
          p_left: pL.toFixed(3),
          p_right: pR.toFixed(3),
          stim_left: STIM_MAP.left,
          stim_right: STIM_MAP.right
        });

        // 次試行に向けて本番用 RW を更新
        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);

        data.__choice = choice;
        data.__feedbackText = reward ? '✓ +1' : '× 0';
        data.__feedbackClass = reward ? 'win' : 'lose';
      }
    };
  }

  // --- タイムライン ---
  const timeline = [instructions];

  // instruction セッションのときだけ、確率デモを挿入
  if (SESSION === 'instruction' && CONFIG.PROB_DEMO_MS > 0){
    timeline.push(probDemoTrial);
  }

  // 練習/本番
  for (let t=0; t<TOTAL_TRIALS; t++){
    // 1) 選択
    timeline.push(trialFactory(t));

    // 2) 選択確認（ACK）
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const ch = last.__choice || 'L';
        const lSel = (ch === 'L'), rSel = (ch === 'R');
        return `
          <div class="small">選択を確認中…</div>
          <div class="choice-row" style="gap:96px; margin-top:18px;">
            ${stimBlockHTML('left', lSel)}
            ${stimBlockHTML('right', rSel)}
          </div>
        `;
      },
      choices: "NO_KEYS",
      trial_duration: CONFIG.ACK_MS
    });

    // 3) 結果フィードバック（✓ +1 / × 0）
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(2).values()[0] || {}; // trialFactory のデータ
        const txt = last.__feedbackText || '';
        const cls = last.__feedbackClass || '';
        return `<div class="jspsych-content"><div class="feedback ${cls}">${txt}</div></div>`;
      },
      choices: "NO_KEYS",
      trial_duration: CONFIG.FEEDBACK_MS
    });

    // 4) ITI
    if (CONFIG.ITI_MS > 0){
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div class="small"> </div>',
        choices: "NO_KEYS",
        trial_duration: CONFIG.ITI_MS
      });
    }
  }

  // 実行
  jsPsych.run(timeline);
});
