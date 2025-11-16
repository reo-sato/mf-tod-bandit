/* mf-tod-bandit main (v8 UMD, keyboard only, Firebase save)
   - 新機能: インストラクション専用セッション
     URL 例: ?session=instruction&pid=S001  または  ?session=instr&pid=S001
*/

const CONFIG = {
  N_TRIALS: 400,        // 本試行の試行数（morning/evening）
  INSTR_PRACTICE_N: 10, // インストラクション専用セッションの練習試行数（0なら説明のみ）
  STEP: 0.03,           // 環境確率のランダムウォーク幅
  ITI_MS: 400,          // 空白（インタートライアル）
  FEEDBACK_MS: 700      // フィードバック表示
};

// --- URL パラメータ ---
const RAW_SESSION = (getParam('session','morning')||'').toLowerCase();
const SESSION = (['instr','instruction','instructions'].includes(RAW_SESSION))
  ? 'instruction'
  : RAW_SESSION;
const PID = getParam('pid', `P${Math.random().toString(36).slice(2,8)}`);

// 実行する総試行数（インストラクション専用セッションでは練習本数に置換）
const TOTAL_TRIALS = (SESSION === 'instruction') ? CONFIG.INSTR_PRACTICE_N : CONFIG.N_TRIALS;

// 環境確率（左右独立ランダムウォーク）
let pL = 0.5, pR = 0.5;

// ログ
const rows = [];

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

  // Firebase 初期化（config/ルール次第で保存、失敗時は main.js 側でCSVへフォールバック）
  const fbInit = (typeof initFirebase === 'function') ? initFirebase() : { ok:false };
  const USE_FIREBASE = !!fbInit.ok;

  // jsPsych 初期化
  const jsPsych = initJsPsych({
    display_element: 'jspsych-target',
    on_finish: async () => {
      const total = rows.reduce((s,r)=>s+(r.reward||0),0);
      const payload = { pid: PID, session: SESSION, total, n: TOTAL_TRIALS, trials: rows };
      let msg = '';

      // 保存（Firebaseが使えれば保存、だめならCSV）
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

      // 終了画面（インストラクション専用セッションは文言を変更）
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

  // --- 説明スライド（セッション別に文言を出し分け） ---
  const introBody = (SESSION === 'instruction')
    ? `<h2>インストラクション</h2>
       <p>このセッションでは課題の説明と<b>短い練習</b>のみ行います（本番は実施しません）。</p>
       <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
       <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`
    : `<h2>2アーム課題</h2>
       <p>左右どちらかを選び、当たり（1）をできるだけ多く集めてください。</p>
       <p>各アームの当たり確率は時間とともに<b>ゆっくり変化</b>します（0.25–0.75）。</p>
       <p>報酬は <b>当たり=1 / はずれ=0</b> です。</p>`;

  const countLine = (SESSION === 'instruction')
    ? `<p>このセッションの練習試行数は <b>${TOTAL_TRIALS}</b> です（0 なら説明のみ）。</p>`
    : `<p>このセッションは <b>${TOTAL_TRIALS}</b> 試行です。</p>`;

  const instructions = {
    type: jsPsychInstructions,
    pages: [
      introBody,
      `<p>選択は<b>キーボードのみ</b>です：</p>
       <p><b>F = 左</b>、<b>J = 右</b></p>
       ${countLine}
       <p>準備ができたら「次へ」を押してください。</p>`
    ],
    show_clickable_nav: true,
    button_label_next: '次へ',
    button_label_previous: '戻る'
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

        // 次のフィードバック用
        data.__feedback = reward ? '✓ +1' : '× 0';
        data.__feedbackClass = reward ? 'win' : 'lose';
      }
    };
  }

  // --- タイムライン構築 ---
  const timeline = [instructions];

  // インストラクション専用セッションで TOTAL_TRIALS=0 の場合は説明のみで終了
  for (let t=0; t<TOTAL_TRIALS; t++){
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
