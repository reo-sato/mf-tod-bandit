# mf-tod-bandit


ブラウザで動く 0/1 報酬の 2 アーム・バンディット課題。GitHub Pages でホスト可能。学習率非対称（α⁺/α⁻）と β（逆温度）の ToD 解析に最適なデータを収集できます。


## 実行
- GitHub Pages で公開後、以下のようにアクセス：
- `/?session=morning&pid=S001`
- `/?session=evening&pid=S001`
- 試行数等は `js/main.js` の `CONFIG` で変更可能。


## データ保存
- 既定：実験終了時に CSV を自動ダウンロード。
- オンライン保存（任意）：`scripts/gas/Code.gs` を Google Apps Script にコピペ→デプロイ（Webアプリ）。URL を `CONFIG.GAS_ENDPOINT` に設定。


## 参考：解析
- ログには trial, choice, reward(0/1), rt, p_left/right（環境確率）, session, pid が含まれます。α⁺/α⁻・β の階層 RW + softmax モデルでフィット可能。


## ライセンス
MIT
