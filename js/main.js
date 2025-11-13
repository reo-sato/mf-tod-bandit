/* mf-tod-bandit main (jsPsych v8 UMD 直読み対応) */

// 設定
const CONFIG = {
  N_TRIALS: 400,     // 試行数
  STEP: 0.03,        // 環境確率のRWステップ幅
  FEEDBACK_MS: 700,  // フィードバック表示時間
  GAS_ENDPOINT: null // 例: 'https://script.google.com/macros/s/XXXXXXXX/exec'
};

// URLパラメータ
const SESSION = (getParam('session','morning') || '').toLowerCase(); // 'morning' or 'evening'
const PID     = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 環境（左右の当たり確率；独立RW）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

// ライブラリ準備チェック（v8 UMD を想定：グローバルに生える）
function libsReady(){
  return (typeof initJsPsych === 'function' &&
          typeof jsPsychHtmlButtonResponse === 'function' &&
          typeof jsPsychInstructions === 'function');
}

// DOM 準備後に実行
document.addEventListener('DOMContentLoaded', () => {
  if (!libsReady()){
    console.error('jsPsych not loaded:', {
      initJsPsych: typeof initJsPsych,
      HtmlBtn: typeof jsPsychHtmlButtonResponse,
      Instr: typeof jsPsychInstructions
    });
    const el = document.getElementById('jspsych-target');
    if (el){
      el.innerHTML =
        '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。CDNのURL/ネットワーク/拡張機能（スクリプトブロッカー）をご確認ください５。</p></div>';
    }
    return;
  }

  // jsPsych 初期化
  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: async () => {
      const total = rows.reduce((s, r) => s + (r.reward || 0), 0);

      // 保存：既定はCSVダウンロード。GAS設定があればPOST
      let msg = '';
      if (CONFIG.GAS_ENDPOINT){
        try{
          const payload = { pid: PID, session: SESSION, total, n: CONFIG.N_TRIALS, trials: rows };
          await fetch(CONFIG.GAS_ENDPOINT, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
          msg = '<div class="small">サーバに送信しました（GAS設定時）。</div>';
        }catch(e){
          msg = `<div class="small">送信に失敗しました: ${e}</div>`;
        }
      }else{
        const csv = toCSV(rows);
        download(`bandit_${PID}_${SESSION}.csv`, csv);
        msg = '<div class="small">CSV をダウンロードしました（GAS未設定）。</div>';
      }

      // 終了画面
      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>終了</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${CONFIG.N_TRIALS}</span></p>
          ${msg}
          <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
        </div>`;
    }
  });

  // 説明スライド
  const instructions = {
    type: jsPsychInstructions,
    pages: [
      `<h2>2アーム課題</h2>
       <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
       <p>各アームの当たり確率は時間とともに <b>ゆっくり変化します</b>（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`,
      `<p>左右は毎試行ごとに選べます。キーボード <b>F=左</b> / <b>J=右</b> でも選択可能です。</p>
       <p>このセッションは <b>${CONFIG.N_TRIALS}</b> 試行です。準備ができたら開始してください。</p>`
    ],
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

  // 1 試行
  function trialFactory(tIndex){
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: () => `
        <div class="small">PID:${PID} / ${SESSION} / Trial ${tIndex+1}
          / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}</div>
        <div class="choice-row">
          <button class="btn">左 (F)</button>
          <button class="btn">右 (J)</button>
        </div>`,
      choices: ['左','右'],
      button_html: ['<button class="btn">%choice%</button>','<button class="btn">%choice%</button>'],
      prompt: '<div class="small">できるだけ多く当ててください</div>',
      response_ends_trial: true,
      on_load: () => {
        // F/J での選択
        const handler = (e)=>{
          const k = e.key?.toLowerCase?.() || '';
          if (k === 'f') document.querySelectorAll('button.btn')[0]?.click();
          if (k === 'j') document.querySelectorAll('button.btn')[1]?.click();
        };
        window.addEventListener('keydown', handler, { once:true });
      },
      on_finish: (data) => {
        const choice  = (data.response === 0 ? 'L' : 'R');
        const pChosen = (choice === 'L' ? pL : pR);
        const reward  = Math.random() < pChosen ? 1 : 0;

        // ログ
        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3)
        });

        // 次試行に向けて環境確率を更新
        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);
      }
    };
  }

  // タイムライン
  const timeline = [instructions];
  for (let t = 0; t < CONFIG.N_TRIALS; t++){
    timeline.push(trialFactory(t));
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
});
