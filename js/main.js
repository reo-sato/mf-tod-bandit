/* mf-tod-bandit main — seeded schedule, arbitrary initial probabilities */

const CONFIG = {
  N_TRIALS: 400,        // 試行数
  STEP: 0.03,           // ランダムウォークのステップ幅
  ITI_MS: 400,          // 空白（インタートライアル）
  FEEDBACK_MS: 700,     // フィードバック表示
  GAS_ENDPOINT: null,   // 例: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec'

  // 確率の境界（必要に応じて変更可）
  BOUNDS: { LO: 0.25, HI: 0.75 },

  // 既定の初期確率（URL で上書き可）
  P0:   { LEFT: 0.60, RIGHT: 0.40 },

  // スケジュール生成の既定シード（URL で上書き可）
  SEED_DEFAULT: 'SCHEDULE_V1'  // 同じシード → 全被験者で同じ遷移
};

// セッション/参加者ID・各種パラメータ（URL パラメータで上書き可）
const SESSION = (getParam('session','morning')||'').toLowerCase();
const PID     = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 初期確率（URL: ?p0l=0.62&p0r=0.38 など）
const p0l = clamp01(parseFloat(getParam('p0l', CONFIG.P0.LEFT)));
const p0r = clamp01(parseFloat(getParam('p0r', CONFIG.P0.RIGHT)));

// スケジュール用シード（URL: ?seed=YOURSEED で上書き）
const SCHEDULE_SEED = getParam('seed', CONFIG.SEED_DEFAULT);

// 便宜関数
function clamp01(x){ return Math.max(0, Math.min(1, Number.isFinite(x)? x : 0)); }

// ===== ここで「全被験者共通」の確率遷移を事前生成 =====
const rng = prngFromString(String(SCHEDULE_SEED)); // utils.js
const SCHED = makeSchedule(
  CONFIG.N_TRIALS,
  p0l, p0r,
  CONFIG.STEP,
  CONFIG.BOUNDS.LO, CONFIG.BOUNDS.HI,
  rng
);

// ログ
const rows = [];

// jsPsych 初期化（v7/UMD 互換：index.html が v7 のためグローバルに直で OK）
const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  on_finish: async () => {
    // 集計
    const total = rows.reduce((s,r)=>s + (r.reward||0), 0);
    let leaderboardText = '';

    // オンライン保存 or CSV
    if (CONFIG.GAS_ENDPOINT){
      try{
        const payload = { pid: PID, session: SESSION, total, n: CONFIG.N_TRIALS, trials: rows };
        await fetch(CONFIG.GAS_ENDPOINT, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
        leaderboardText = '<div class="small">サーバに送信しました（ランキングはGAS設定後に表示）。</div>';
      }catch(e){
        leaderboardText = `<div class="small">送信に失敗しました: ${e}</div>`;
      }
    } else {
      const csv = toCSV(rows);
      download(`bandit_${PID}_${SESSION}.csv`, csv);
      leaderboardText = '<div class="small">CSV をダウンロードしました（GAS未設定）。</div>';
    }

    // 終了画面
    document.body.innerHTML = `
      <div class="jspsych-content">
        <h2>終了</h2>
        <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${CONFIG.N_TRIALS}</span></p>
        ${leaderboardText}
        <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
      </div>`;
  }
});

// 説明
const instructions = {
  type: jsPsychInstructions,
  pages: [
    `<h2>2アーム課題</h2>
     <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
     <p>各アームの当たり確率は時間とともに <b>ゆっくり変化します</b>（${CONFIG.BOUNDS.LO.toFixed(2)}–${CONFIG.BOUNDS.HI.toFixed(2)}）。</p>
     <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`,
    `<p>左右は毎試行ごとに選べます。キーボード <b>F=左</b> / <b>J=右</b> でも選択可能です。</p>
     <p>このセッションは <b>${CONFIG.N_TRIALS}</b> 試行です。</p>`
  ],
  show_clickable_nav: true,
  button_label_next: '次へ',
  button_label_previous: '戻る'
};

// 1試行（確率は事前生成したスケジュールから取り出す）
function trialFactory(tIndex){
  // この試行の環境確率（全被験者で同一）
  const pL = SCHED.left[tIndex];
  const pR = SCHED.right[tIndex];

  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      return `
        <div class="small">
          PID: ${PID} / Session: ${SESSION} / Trial ${tIndex+1}
          / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}
        </div>
        <div class="choice-row">
          <button class="btn" id="left">左 (F)</button>
          <button class="btn" id="right">右 (J)</button>
        </div>`;
    },
    choices: ['左','右'],
    button_html: ['<button class="btn">%choice%</button>','<button class="btn">%choice%</button>'],
    prompt: '<div class="small">できるだけ多く当ててください</div>',
    response_ends_trial: true,
    on_load: () => {
      // F/J でも選択可能（クリックは可のまま）
      const handler = (e)=>{
        const k = e.key?.toLowerCase?.() || '';
        if (k === 'f') document.querySelectorAll('button.btn')[0]?.click();
        if (k === 'j') document.querySelectorAll('button.btn')[1]?.click();
      };
      window.addEventListener('keydown', handler, { once:true });
    },
    on_finish: (data) => {
      const choice = (data.response===0? 'L':'R');
      const p_chosen = (choice==='L'? pL : pR);
      const reward = Math.random() < p_chosen ? 1 : 0;  // ※報酬サンプリングは各被験者で独立のまま

      // 簡易フィードバック
      jsPsych.getDisplayElement().innerHTML = `<div class="jspsych-content">
        <div class="feedback ${reward? 'win':'lose'}">${reward? '✓ +1':'× 0'}</div>
      </div>`;

      // ログ（この試行で用いた環境確率を記録）
      rows.push({
        pid: PID,
        session: SESSION,
        trial: tIndex+1,
        choice: choice,
        reward: reward,
        rt: data.rt,
        p_left: pL.toFixed(3),
        p_right: pR.toFixed(3),
        seed: SCHEDULE_SEED
      });
    }
  };
}

// タイムライン構築
const timeline = [instructions];
for(let t=0; t<CONFIG.N_TRIALS; t++){
  timeline.push(trialFactory(t));
  // フィードバック表示
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: '<div class="small">...</div>',
    choices: [],
    trial_duration: CONFIG.FEEDBACK_MS,
    response_ends_trial: false
  });
}

// 実行
jsPsych.run(timeline);
