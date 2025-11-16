/* mf-tod-bandit main */
// キー操作（F/J）
const handler = (e)=>{
if(e.key.toLowerCase()==='f') document.querySelectorAll('button')[0].click();
if(e.key.toLowerCase()==='j') document.querySelectorAll('button')[1].click();
};
window.addEventListener('keydown', handler, { once:true });
},
on_finish: (data) => {
const choice = (data.response===0? 'L':'R');
const p_chosen = (choice==='L'? pL : pR);
const reward = Math.random() < p_chosen ? 1 : 0;


// 反応時間
const rt = data.rt;


// フィードバック表示
jsPsych.getDisplayElement().innerHTML = `<div class="jspsych-content">
<div class="feedback ${reward? 'win':'lose'}">${reward? '✓ +1':'× 0'}</div>
</div>`;


// ログ
rows.push({
pid: PID,
session: SESSION,
trial: tIndex+1,
choice: choice,
reward: reward,
rt: rt,
p_left: pL.toFixed(3),
p_right: pR.toFixed(3)
});


// 環境確率を更新（左右とも RW）
pL = rwStep(pL, CONFIG.STEP);
pR = rwStep(pR, CONFIG.STEP);
}
};
}


// タイムライン構築
const timeline = [instructions];
for(let t=0; t<CONFIG.N_TRIALS; t++){
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
