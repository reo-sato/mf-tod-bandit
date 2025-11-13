/* mf-tod-bandit main (jsPsych v8, UMD) */
document.addEventListener('DOMContentLoaded', () => {
  // ライブラリが見えているか（デバッグ）
  if (typeof initJsPsych !== 'function' ||
      typeof jsPsychHtmlButtonResponse !== 'function' ||
      typeof jsPsychInstructions !== 'function') {
    console.error('jsPsych not loaded:', {
      initJsPsych: typeof initJsPsych,
      HtmlBtn: typeof jsPsychHtmlButtonResponse,
      Instr: typeof jsPsychInstructions
    });
    const el = document.getElementById('jspsych-target');
    if (el) el.innerHTML =
      '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました（CDN/ネットワーク/拡張機能を確認）。</p></div>';
    return;
  }

  const CONFIG = { N_TRIALS: 400, STEP: 0.03, FEEDBACK_MS: 700, GAS_ENDPOINT: null };

  const SESSION = (getParam('session','morning')||'').toLowerCase();
  const PID     = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

  let pL = 0.5, pR = 0.5;
  const rows = [];

  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: () => {
      const total = rows.reduce((s,r)=>s+(r.reward||0),0);
      const csv = toCSV(rows);
      download(`bandit_${PID}_${SESSION}.csv`, csv);
      document.body.innerHTML = `
        <div class="jspsych-content">
          <h2>終了</h2>
          <p class="big">合計スコア：<b>${total}</b> <span class="badge">N=${CONFIG.N_TRIALS}</span></p>
          <div class="footer">PID: ${PID} / Session: ${SESSION}</div>
        </div>`;
    }
  });

  const instructions = {
    type: jsPsychInstructions,
    pages: [
      `<h2>2アーム課題</h2>
       <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
       <p>各アームの当たり確率は時間とともに <b>ゆっくり変化します</b>（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`,
      `<p>F=左 / J=右 でも選べます。全 ${CONFIG.N_TRIALS} 試行です。</p>`
    ],
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
  };

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
      on_load: () => {
        const h = (e)=>{
          const k = e.key?.toLowerCase?.() || '';
          if (k==='f') document.querySelectorAll('button.btn')[0]?.click();
          if (k==='j') document.querySelectorAll('button.btn')[1]?.click();
        };
        window.addEventListener('keydown', h, { once:true });
      },
      on_finish: (data) => {
        const choice  = (data.response===0? 'L':'R');
        const pChosen = (choice==='L'? pL : pR);
        const reward  = Math.random() < pChosen ? 1 : 0;

        rows.push({ pid:PID, session:SESSION, trial:tIndex+1,
                    choice, reward, rt:data.rt,
                    p_left:pL.toFixed(3), p_right:pR.toFixed(3) });

        pL = rwStep(pL, CONFIG.STEP);
        pR = rwStep(pR, CONFIG.STEP);
      }
    };
  }

  const timeline = [instructions];
  for (let t=0; t<CONFIG.N_TRIALS; t++){
    timeline.push(trialFactory(t));
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: '<div class="small">...</div>',
      choices: [],
      trial_duration: CONFIG.FEEDBACK_MS,
      response_ends_trial: false
    });
  }

  jsPsych.run(timeline);
});
