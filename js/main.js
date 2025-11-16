/* mf-tod-bandit main — v7 UMD, button UI + F/J キー, 1.5 s デッドライン + ITI ジッター */

// 実験設定
const CONFIG = {
  N_TRIALS: 400,          // 試行数
  STEP: 0.03,             // 環境確率ランダムウォーク幅
  FEEDBACK_MS: 700,       // フィードバック表示
  // 追加：選択デッドライン（先行研究に合わせ 1500ms）
  DECISION_DEADLINE_MS: 1500,
  // 追加：ITI を 1000–1500ms の範囲でジッター
  ITI_RANGE_MS: { MIN: 1000, MAX: 1500 },

  GAS_ENDPOINT: null      // 例: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec'
};

// セッション/参加者ID（URL パラメータ）
const SESSION = (getParam('session','morning')||'').toLowerCase();
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 環境確率（左右独立 RW）
let pL = 0.5, pR = 0.5;

// ログ用配列
const rows = [];

// ITI ジッター用のユーティリティ
function randITI(){
  const a = CONFIG.ITI_RANGE_MS.MIN;
  const b = CONFIG.ITI_RANGE_MS.MAX;
  return Math.floor(a + Math.random()*(b - a));
}

// jsPsych 初期化
const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  on_finish: async () => {
    // 集計
    const total = rows.reduce((s,r)=>s + ((r.reward===1)?1:0), 0);
    let leaderboardText = '';

    // オンライン保存 or ローカル CSV
    if (CONFIG.GAS_ENDPOINT){
      try{
        const payload = { pid: PID, session: SESSION, total, n: CONFIG.N_TRIALS, trials: rows };
        await fetch(CONFIG.GAS_ENDPOINT, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
        leaderboardText = '<div class="small">サーバに送信しました（ランキングはGAS設定後に表示）。</div>';
      }catch(e){ leaderboardText = `<div class="small">送信に失敗しました: ${e}</div>`; }
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
     <p>各アームの当たり確率は時間とともに <b>ゆっくり変化します</b>（0.25–0.75）。</p>
     <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`,
    `<p><b>F = 左</b>、<b>J = 右</b> で選択できます（ボタンのクリックでも可）。</p>
     <p>各試行の選択時間には <b>${CONFIG.DECISION_DEADLINE_MS} ms</b> の制限があります。</p>
     <p>このセッションは <b>${CONFIG.N_TRIALS}</b> 試行です。</p>`
  ],
  show_clickable_nav: true,
  button_label_next: '次へ',
  button_label_previous: '戻る'
};

// 1試行の定義（デッドライン + ITI ジッター）
function trialFactory(tIndex){
  // ITI はこの試行の終了後に用いる値を先にサンプリングしておく
  const itiDur = randITI();

  return [
    // 選択フェーズ（1.5 s デッドライン）
    {
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
          </div>
          <div class="small" style="margin-top:8px;">制限時間：${CONFIG.DECISION_DEADLINE_MS} ms</div>`;
      },
      choices: ['左','右'],
      button_html: ['<button class="btn">%choice%</button>','<button class="btn">%choice%</button>'],
      prompt: '<div class="small">できるだけ多く当ててください</div>',
      trial_duration: CONFIG.DECISION_DEADLINE_MS,   // ← 時間制限
      response_ends_trial: true,
      on_load: () => {
        // F/J キーをボタンにマッピング
        const handler = (e)=>{
          const k = e.key?.toLowerCase?.() || '';
          if (k==='f') document.querySelectorAll('button.btn')[0]?.click();
          if (k==='j') document.querySelectorAll('button.btn')[1]?.click();
        };
        window.addEventListener('keydown', handler, { once:true });
      },
      on_finish: (data) => {
        // タイムアウト判定
        const timedOut = (data.response === null || data.rt === null);
        let choice, reward;

        if (timedOut){
          choice = 'NA';
          reward = 0; // 時間切れは無得点扱い（分析では miss フラグで除外可）
          data.__feedback = '時間切れ';
          data.__feedbackClass = 'lose';
        } else {
          choice = (data.response === 0 ? 'L' : 'R');
          const pChosen = (choice === 'L' ? pL : pR);
          reward = Math.random() < pChosen ? 1 : 0;
          data.__feedback = reward ? '✓ +1' : '× 0';
          data.__feedbackClass = reward ? 'win' : 'lose';
        }

        // ログ（この試行の環境確率・結果）
        rows.push({
          pid: PID,
          session: SESSION,
          trial: tIndex+1,
          choice,
          reward,
          rt: data.rt,
          miss: timedOut ? 1 : 0,
          deadline_ms: CONFIG.DECISION_DEADLINE_MS,
          iti_ms: itiDur,                 // 次に挿入する ITI の長さを記録
          p_left: pL.toFixed(3),
          p_right: pR.toFixed(3)
        });

        // 次試行に向けて環境確率を更新（左右とも RW）
        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);

        // この後のフィードバック／ITI で参照するため保存
        data.__iti = itiDur;
      }
    },

    // フィードバック
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const txt = last.__feedback || '';
        const cls = last.__feedbackClass || '';
        return `<div class="jspsych-content"><div class="feedback ${cls}">${txt}</div></div>`;
      },
      choices: [],
      trial_duration: CONFIG.FEEDBACK_MS,
      response_ends_trial: false
    },

    // ITI（ジッター）
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="small"> </div>',
      choices: [],
      trial_duration: function(){
        const last = jsPsych.data.get().last(2).values()[0] || {};
        return last.__iti || randITI();
      },
      response_ends_trial: false
    }
  ];
}

// タイムライン構築
const timeline = [instructions];
for (let t=0; t<CONFIG.N_TRIALS; t++){
  // trialFactory は [選択, フィードバック, ITI] の3要素配列を返す
  timeline.push(...trialFactory(t));
}

jsPsych.run(timeline);
