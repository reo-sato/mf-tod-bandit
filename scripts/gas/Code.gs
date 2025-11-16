/**
 * Google Apps Script（Webアプリ）— 受信データをスプレッドシートに追記
 *
 * 使い方：
 * 1) Google ドライブでスプレッドシートを作成 → 「拡張機能」→「Apps Script」を開く。
 * 2) 本ファイルの内容を貼り付けて保存。プロジェクトをこのシートに「バインド」した状態で使うのが簡単です。
 * 3) 「デプロイ」→「新しいデプロイ」→「種類：ウェブアプリ」
 *    - 実行するアプリ：このアプリ
 *    - 実行するユーザー：自分
 *    - アクセスできるユーザー：全員（匿名含む）
 *    でデプロイし、発行URL（/exec）を `CONFIG.GAS_ENDPOINT` に設定。
 *
 * 注意：
 * - クライアントは fetch(..., { mode:'no-cors', headers:{'Content-Type':'text/plain'}, body: JSON.stringify(...) })
 *   で送ります。レスポンスは読みません（CORS/プリフライトを避けるため）。
 * - スプレッドシートは「このスクリプトが有効な」スプレッドシート（Active）に記録します。
 */

const SHEET_NAME = 'trials';     // 保存先のシート名

function doPost(e){
  try{
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // 受信ボディ（text/plainでJSON文字列）
    const body = e.postData && e.postData.getDataAsString
      ? e.postData.getDataAsString()
      : (e.postData ? e.postData.contents : '');

    if (!body) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok:false, error:'empty body' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const payload = JSON.parse(body);
    const { pid, session, total, n, trials } = payload;

    // ヘッダ（なければ付与）
    const header = ['timestamp','pid','session','trial','choice','reward','rt','p_left','p_right','total','n'];
    if (sh.getLastRow() === 0){
      sh.appendRow(header);
    }

    const ts = new Date();
    const values = (trials || []).map(r => [
      ts,
      r.pid ?? pid,
      r.session ?? session,
      r.trial ?? '',
      r.choice ?? '',
      r.reward ?? '',
      r.rt ?? '',
      r.p_left ?? '',
      r.p_right ?? '',
      total ?? '',
      n ?? ''
    ]);

    if (values.length > 0){
      sh.getRange(sh.getLastRow()+1, 1, values.length, header.length).setValues(values);
    }

    // レスポンス（no-cors なのでクライアント側では参照しない）
    return ContentService
      .createTextOutput(JSON.stringify({ ok:true, rows: values.length }))
      .setMimeType(ContentService.MimeType.JSON);

  }catch(err){
    return ContentService
      .createTextOutput(JSON.stringify({ ok:false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 任意：動作確認用に GET でステータス確認
function doGet(e){
  return ContentService
    .createTextOutput(JSON.stringify({ ok:true, service:'mf-tod-bandit', time:(new Date()).toISOString() }))
    .setMimeType(ContentService.MimeType.JSON);
}
