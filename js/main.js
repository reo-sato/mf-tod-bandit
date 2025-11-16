/* mf-tod-bandit main — v7（UMD, button+F/J）, timeline説明を追加・ITIを明示 */
const CONFIG = {
  N_TRIALS: 400,
  STEP: 0.03,            // ランダムウォークのステップ幅
  ITI_MS: 400,           // 休止（空白）時間
  FEEDBACK_MS: 700,      // フィードバック表示時間
  GAS_ENDPOINT: null     // 例: 'https://script.google.com/macros/s/XXXXXXXXXXXXXXXX/exec'
};

// セッション/参加者ID（URL パラメータ）
const SESSION = (getParam('session','morning')||'').toLowerCase();
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 環境確率（左右独立 RW）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

// jsPsych 初期化
const jsPsych = initJsPsych({
  display_element: 'jspsych-target',
  on_finish: async () => {
    const total = rows.reduce((s,r)=>s + (r.reward||0), 0);
    let savedMsg = '';

    // オンライン保存（任意）
    if (CONFIG.GAS_ENDPOINT){
      try{
        const payload = { pid: PID, session: SESSION, total, n: CONFIG.N_TRIALS, trials: rows };
        await fetch(CONFIG.GAS_ENDPOINT, { method:'POST', mode:'no-cors', body: JSON.stringify(payload) });
        savedMsg = '<div class="small">サーバに送信しました（ランキングはGAS設定後に表示）。</div>';
      }catch(e){
        savedMsg = `<div class="small">送信に失敗しました: ${e}</div>`;
      }
    } else {
      const csv = toCSV(rows);
      download(`bandit_${PID}_${SESSION}.csv`, csv);
      savedMsg = '<div class="small">CSV をダウンロードしました（GAS未設定）。</div>';
    }

    // 終了画面
    document.body.innerHTML = `
      <div class="jspsych-content">
        <h2>終了</h2>
        <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${CONFIG.N_TRIALS}</span></p>
        ${savedMsg}
        <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
      </div>`;
  }
});

// --- インストラクション（タイムライン説明ページを追加） ---
const instructions = {
  type: jsPsychInstructions,
  pages: [
    // 1. 課題概要
    `<h2>2アーム課題</h2>
     <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
     <p>各アームの当たり確率は時間とともに <b>ゆっくり変化</b>します（0.25–0.75）。</p>
     <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>` ,

    // 2. 操作方法と試行数
    `<p>各試行で <b>左/右</b> のどちらかを選びます。キーボード <b>F=左</b> / <b>J=右</b> でも選択できます。</p>
     <p>このセッションは <b>${CONFIG.N_TRIALS}</b> 試行です。</p>`,

    // 3. タイムラインの明示（選択→フィードバック→ITI）
    `<h3>1試行のタイムライン</h3>
     <div class="flow">
       <div class="flow-item">
         <div class="flow-title">選択</div>
         <div class="flow-desc">F=左 / J=右</div>
       </div>
       <div class="flow-arrow">→</div>
       <div class="flow-item">
         <div class="flow-title">報酬提示</div>
         <div class="flow-desc">✓ +1 / × 0（約 ${CONFIG.FEEDBACK_MS} ms）</div>
       </div>
       <div class="flow-arrow">→</div>
       <div class="flow-item">
         <div class="flow-title">ITI</div>
         <div class="flow-desc">空白画面（約 ${CONFIG.ITI_MS} ms）</div>
       </div>
       <div class="flow-arrow">→</div>
       <div class="flow-item">
         <div class="flow-title">次の試行</div>
       </div>
     </div>
     <p class="small">※ 当たり確率は各試行間で緩やかに変化します（0.25–0.75, 反射境界 RW）。</p>
     <p>準備ができたら「次へ」を押してください。</p>`
  ],
  show_clickable_nav: true,
  button_label_next: '次へ',
  button_label_previous: '戻る'
};

// 1試行
function trialFactory(tIndex){
  return {
    type: jsPsychHtmlButtonResponse,
    stimulus: () => `
      <div class="small">
        PID: ${PID} / Session: ${SESSION} / Trial ${tIndex+1}
        / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}
      </div>
      <div class="choice-row">
        <button class="btn" id="left">左 (F)</button>
        <button class="btn" id="right">右 (J)</button>
      </div>
    `,
    choices: ['左','右'],
    button_html: [
      '<button class="btn">%choice%</button>',
      '<button class="btn">%choice%</button>'
    ],
    prompt: '<div class="small">キー（F/J）でも選べます</div>',
    response_ends_trial: true,
    on_load: () => {
      // キー操作（F/J）でボタンを「押す」
      const handler = (e)=>{
        const k = (e.key||'').toLowerCase();
        if(k==='f') document.querySelectorAll('button.btn')[0]?.click();
        if(k==='j') document.querySelectorAll('button.btn')[1]?.click();
      };
      window.addEventListener('keydown', handler, { once:true });
    },
    on_finish: (data) => {
      const choice = (data.response===0? 'L':'R');
      const p_chosen = (choice==='L'? pL : pR);
      const reward = Math.random() < p_chosen ? 1 : 0;

      rows.push({
        pid: PID, session: SESSION, trial: tIndex+1,
        choice, reward, rt: data.rt,
        p_left: pL.toFixed(3), p_right: pR.toFixed(3)
      });

      // 次試行に向けて環境確率を更新
      pL = rwStep(pL, CONFIG.STEP);
      pR = rwStep(pR, CONFIG.STEP);

      // 次のフィードバック画面用にデータへ付与
      data.__fb_text = reward ? '✓ +1' : '× 0';
      data.__fb_class = reward ? 'win'   : 'lose';
    }
  };
}

// タイムライン構築
const timeline = [instructions];

for(let t=0; t<CONFIG.N_TRIALS; t++){
  // 選択
  timeline.push(trialFactory(t));
  // フィードバック（キー無効, 一定時間）
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: function(){
      const last = jsPsych.data.get().last(1).values()[0] || {};
      const txt = last.__fb_text || '';
      const cls = last.__fb_class || '';
      return `<div class="jspsych-content"><div class="feedback ${cls}">${txt}</div></div>`;
    },
    choices: [],
    trial_duration: CONFIG.FEEDBACK_MS,
    response_ends_trial: false
  });
  // ITI（キー無効, 一定時間）— 明示的に追加
  if (CONFIG.ITI_MS > 0){
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="small"> </div>',
      choices: [],
      trial_duration: CONFIG.ITI_MS,
      response_ends_trial: false
    });
  }
}

jsPsych.run(timeline);
