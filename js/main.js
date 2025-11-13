/* mf-tod-bandit main (UMD-safe) */
(function () {
  document.addEventListener('DOMContentLoaded', function () {

    // UMD/ESM 両対応の参照（UMDを優先）
    const INIT    = (window.jsPsychModule && window.jsPsychModule.initJsPsych) || window.initJsPsych;
    const HtmlBtn = window.jsPsychHtmlButtonResponse;
    const Instr   = window.jsPsychInstructions;

    // 失敗時はメッセージを出して停止
    if (typeof INIT !== 'function' || typeof HtmlBtn !== 'function' || typeof Instr !== 'function') {
      console.error('jsPsych not loaded:', { INIT, HtmlBtn, Instr });
      const el = document.getElementById('jspsych-target');
      if (el) el.innerHTML =
        '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。index.htmlでUMD版の読み込み順（ライブラリ→自作JS）をご確認ください。</p></div>';
      return;
    }

    const CONFIG = { N_TRIALS: 400, STEP: 0.03, FEEDBACK_MS: 700, GAS_ENDPOINT: null };

    const SESSION = (getParam('session','morning')||'').toLowerCase();
    const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

    let pL = 0.5, pR = 0.5;
    const rows = [];

    const jsPsych = INIT({
      display_element: 'jspsych-target',
      on_finish: async () => {
        const total = rows.reduce((s,r)=>s + (r.reward||0), 0);
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
      type: Instr,
      pages: [
        `<h2>2アーム課題</h2>
         <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
         <p>各アームの当たり確率は時間とともに <b>ゆっくり変化します</b>（0.25–0.75）。</p>
         <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`,
        `<p>F=左 / J=右 でも選べます。全 ${CONFIG.N_TRIALS} 試行。</p>`
      ],
      show_clickable_nav: true,
      button_label_next: '次へ',
      button_label_previous: '戻る'
    };

    function rwStepLocal(p, step){
      // utils.js の rwStep が居ればそれを使う
      if (typeof rwStep === 'function') return rwStep(p, step);
      const s = Math.random() < 0.5 ? -step : step;
      let v = p + s, lo = 0.25, hi = 0.75;
      if (v < lo) v = lo + (lo - v);
      if (v > hi) v = hi - (v - hi);
      return Math.max(lo, Math.min(hi, v));
    }

    function trialFactory(tIndex){
      return {
        type: HtmlBtn,
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
          const handler = (e)=>{
            if(e.key.toLowerCase()==='f') document.querySelectorAll('button.btn')[0]?.click();
            if(e.key.toLowerCase()==='j') document.querySelectorAll('button.btn')[1]?.click();
          };
          window.addEventListener('keydown', handler, { once:true });
        },
        on_finish: (data) => {
          const choice = (data.response===0? 'L':'R');
          const p = (choice==='L'? pL : pR);
          const reward = Math.random() < p ? 1 : 0;

          jsPsych.getDisplayElement().innerHTML =
            `<div class="jspsych-content"><div class="feedback ${reward? 'win':'lose'}">
               ${reward? '✓ +1':'× 0'}
             </div></div>`;

          rows.push({ pid:PID, session:SESSION, trial:tIndex+1, choice, reward, rt:data.rt,
                      p_left:pL.toFixed(3), p_right:pR.toFixed(3) });

          pL = rwStepLocal(pL, CONFIG.STEP);
          pR = rwStepLocal(pR, CONFIG.STEP);
        }
      };
    }

    const timeline = [instructions];
    for(let t=0; t<CONFIG.N_TRIALS; t++){
      timeline.push(trialFactory(t));
      timeline.push({
        type: HtmlBtn,
        stimulus: '<div class="small">...</div>',
        choices: [],
        trial_duration: CONFIG.FEEDBACK_MS,
        response_ends_trial: false
      });
    }

    jsPsych.run(timeline);
  });
})();
