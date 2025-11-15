/* mf-tod-bandit main (v8 UMD, keyboard only) */
const CONFIG = {
  N_TRIALS: 400,
  STEP: 0.03,          // 環境確率のランダムウォーク幅
  ITI_MS: 400,         // 空白（インタートライアル）ms
  FEEDBACK_MS: 700,    // フィードバック表示ms
  GAS_ENDPOINT: null   // 例: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec'
};

// URL パラメータ
const SESSION = (getParam('session','morning')||'').toLowerCase();
const PID     = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 環境確率（左右独立ランダムウォーク）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

// v8(UMD) がロード済みか軽くチェック
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

  // jsPsych 初期化
  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: async () => {
      const total = rows.reduce((s,r)=>s+(r.reward||0),0);
      let msg = '';

      if (CONFIG.GAS_ENDPOINT){
        try{
          const payload = { pid: PID, session: SESSION, total, n: CONFIG.N_TRIALS, trials: rows };
          await fetch(CONFIG.GAS_ENDPOINT, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
          msg = '<div class="small">サーバに送信しました（GAS設定時）。</div>';
        }catch(e){
          msg = `<div class="small">送信に失敗しました: ${e}</div>`;
        }
      } else {
        const csv = toCSV(rows);
        download(`bandit_${PID}_${SESSION}.csv`, csv);
        msg = '<div class="small">CSV をダウンロードしました（GAS未設定）。</div>';
      }

      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>終了</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${CONFIG.N_TRIALS}</span></p>
          ${msg}
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
      `<p>選択は<b>キーボードのみ</b>です：</p>
       <p><b>F = 左</b>、<b>J = 右</b></p>
       <p>このセッションは <b>${CONFIG.N_TRIALS}</b> 試行です。準備ができたら開始してください。</p>`
    ],
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // 1試行（キー押し）
  function trialFactory(tIndex){
    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: () => `
        <div class="small">
          PID: ${PID} / Session: ${SESSION} / Trial ${tIndex+1}
          / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}
        </div>
        <div class="choice-row" style="gap:96px; margin-top:24px;">
          <div>
            <div style="font-size:22px; margin-bottom:8px;">左</div>
            <div class="btn" style="display:inline-block; padding:10px 18px;">F</div>
          </div>
          <div>
            <div style="font-size:22px; margin-bottom:8px;">右</div>
            <div class="btn" style="display:inline-block; padding:10px 18px;">J</div>
          </div>
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

        // ログ
        rows.push({
          pid: PID,
          session: SESSION,
          trial: tIndex+1,
          choice,
          reward,
          rt: data.rt,
          p_left: pL.toFixed(3),
          p_right: pR.toFixed(3)
        });

        // 次試行に向けて環境確率を更新
        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);

        // 次のフィードバック用に保存
        data.__feedback = reward ? '✓ +1' : '× 0';
        data.__feedbackClass = reward ? 'win' : 'lose';
      }
    };
  }

  // タイムライン
  const timeline = [instructions];
  for (let t=0; t<CONFIG.N_TRIALS; t++){
    timeline.push(trialFactory(t));

    // フィードバック（キー入力不可）
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: function(){
        const last = jsPsych.data.get().last(1).values()[0] || {};
        const txt = last.__feedback || '';
        const cls = last.__feedbackClass || '';
        return `<div class="jspsych-content"><div class="feedback ${cls}">${txt}</div></div>`;
      },
      choices: "NO_KEYS",
      trial_duration: CONFIG.FEEDBACK_MS
    });

    // ITI（キー入力不可）
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
