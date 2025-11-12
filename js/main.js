// js/main.js
export function runTask({ initJsPsych, plugins, utils }){
  const { htmlButtonResponse, instructions } = plugins;
  const { getParam, rwStep, toCSV, download } = utils;

  const CONFIG = {
    N_TRIALS: 400,
    STEP: 0.03,         // 確率RWステップ幅
    FEEDBACK_MS: 700,
    GAS_ENDPOINT: null  // 例: 'https://script.google.com/macros/s/XXXXXXXX/exec'
  };

  const SESSION = (getParam('session','morning')||'').toLowerCase();
  const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

  let pL = 0.5, pR = 0.5;        // 環境確率
  const rows = [];               // ログ

  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: async () => {
      const total = rows.reduce((s,r)=>s + (r.reward||0), 0);
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

  const intro = {
    type: instructions,
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

  function trialFactory(tIndex){
    return {
      type: htmlButtonResponse,
      stimulus: () => `
        <div class="small">PID: ${PID} / Session: ${SESSION} / Trial ${tIndex+1}
          / pL=${pL.toFixed(2)} pR=${pR.toFixed(2)}</div>
        <div class="choice-row">
          <button class="btn" id="left">左 (F)</button>
          <button class="btn" id="right">右 (J)</button>
        </div>`,
      choices: ['左','右'],
      button_html: ['<button class="btn">%choice%</button>','<button class="btn">%choice%</button>'],
      prompt: '<div class="small">できるだけ多く当ててください</div>',
      response_ends_trial: true,
      on_load: () => {
        const handler = (e)=>{
          if(e.key.toLowerCase()==='f') document.querySelectorAll('button')[0]?.click();
          if(e.key.toLowerCase()==='j') document.querySelectorAll('button')[1]?.click();
        };
        window.addEventListener('keydown', handler, { once:true });
      },
      on_finish: (data) => {
        const choice = (data.response===0? 'L':'R');
        const p_chosen = (choice==='L'? pL : pR);
        const reward = Math.random() < p_chosen ? 1 : 0;

        jsPsych.getDisplayElement().innerHTML =
          `<div class="jspsych-content"><div class="feedback ${reward? 'win':'lose'}">
            ${reward? '✓ +1':'× 0'}</div></div>`;

        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3)
        });

        // 次試行に向けて確率を更新
        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);
      }
    };
  }

  const timeline = [intro];
  for(let t=0; t<CONFIG.N_TRIALS; t++){
    timeline.push(trialFactory(t));
    timeline.push({
      type: htmlButtonResponse,
      stimulus: '<div class="small">...</div>',
      choices: [],
      trial_duration: CONFIG.FEEDBACK_MS,
      response_ends_trial: false
    });
  }

  jsPsych.run(timeline);
}
