/**
* データ受信＋スプレッドシートに追記（Webアプリとしてデプロイ）
* - デプロイ後の URL を `CONFIG.GAS_ENDPOINT` に設定
* - 1つのスプレッドシートに trial レベルのログを追記
*/


const SHEET_NAME = 'trials';


function doPost(e){
try{
const ss = SpreadsheetApp.getActive();
const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
const body = e.postData.getDataAsString();
const payload = JSON.parse(body);
const { pid, session, n, total, trials } = payload;


// ヘッダ
const header = ['timestamp','pid','session','trial','choice','reward','rt','p_left','p_right'];
if (sh.getLastRow() === 0) sh.appendRow(header);


const now = new Date();
const rows = trials.map(r=>[
now, r.pid, r.session, r.trial, r.choice, r.reward, r.rt, r.p_left, r.p_right
]);
sh.getRange(sh.getLastRow()+1, 1, rows.length, header.length).setValues(rows);


return ContentService.createTextOutput(JSON.stringify({ ok:true })).setMimeType(ContentService.MimeType.JSON);
}catch(err){
return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err) })).setMimeType(ContentService.MimeType.JSON);
}
}
