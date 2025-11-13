/* mf-tod-bandit main (UMD-safe, braces-checked) */
document.addEventListener('DOMContentLoaded', () => {
  // --- UMD/ESM 両対応の参照（UMD優先） ---
  const INIT    = (window.jsPsychModule && window.jsPsychModule.initJsPsych) || window.initJsPsych;
  const HtmlBtn = window.jsPsychHtmlButtonResponse;
  const Instr   = window.jsPsychInstructions;

  // ロード確認（失敗時は画面に告知して終了）
  if (typeof INIT !== 'function' || typeof HtmlBtn !== 'function' || typeof Instr !== 'function') {
    console.error('jsPsych not loaded:', { INIT, HtmlBtn, Instr });
    const el = document.getElementById('jspsych-target');
    if (el) {
      el.innerHTML = '<div class="jspsych-content"><p style="color:#f87171">jsPsychの読み込みに失敗しました。index.html で「UMDライブラリ →（deferで）自作JS」の順になっているか確認してください。</p></div>';
    }
    return;
  }

  // ----------------- 設定 -----------------
  const CONFIG = { N_TRIALS: 400, STEP: 0.03, FEEDBACK_MS: 700, GAS_ENDPOINT: null };

  // ----------------- utils（utils.js 由来） -----------------
  // getParam, rwStep, toCSV, download が global に居る前提

  const SESSION = (getParam('session','morning')||'').toLowerCase();
  const PID     = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

  let pL = 0.5, pR = 0.5;           // 環境確率
  const rows = [];                  // ログ

  // ----------------- jsPsych 初期化 -----------------
  const jsPsych = INIT({
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

  // ----------------- 説明 -----------------
  const instructions = {
    type: Instr,
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

  // ----------------- 1試行 -----------------
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
          const k = e.key?.toLowerCase?.() || '';
          if (k === 'f') document.querySelectorAll('button.btn')[0]?.click();
          if (k === 'j') document.querySelectorAll('button.btn')[1]?.click();
        };
        window.addEventListener('keydown', handler, { once:true });
      },
      on_finish: (data) => {
        const choice  = (data.response===0? 'L':'R');
        const pChosen = (choice==='L'? pL : pR);
        const reward  = Math.random() < pChosen ? 1 : 0;

        // 短いフィードバックは次の休止試行で表示（ここではログだけ）
        rows.push({
          pid: PID, session: SESSION, trial: tIndex+1,
          choice, reward, rt: data.rt,
          p_left: pL.toFixed(3), p_right: pR.toFixed(3)
        });

        // 次試行に向けて確率を更新
        pL = typeof rwStep === 'function' ? rwStep(pL, CONFIG.STEP) : pL;
        pR = typeof rwStep === 'function' ? rwStep(pR, CONFIG.STEP) : pR;
      }
    };
  }

  // ----------------- タイムライン -----------------
  const timeline = [instructions];
  for (let t=0; t<CONFIG.N_TRIALS; t++) {
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
