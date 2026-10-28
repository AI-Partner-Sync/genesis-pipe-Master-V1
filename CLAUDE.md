# Genesis Pipe (AI Partner Sync)

Google Apps Script（GAS）+ Gemini APIで動くAI伴走者チャット＆振り返りシステム。フレームワーク不使用のVanilla JS/HTML/CSS。詳細は `README.md` 参照。

## 経営方針: おもてなしの心（2026-10-28 Rikki決定）

RIKKIS ROOM事業の経営方針として、トレーニングの仕組みであっても「おもてなしの心」を組み込む。画面・文言・GASの動きを作る時は、次を守る。

- 先回りする: 利用者がつまずきそうな所を先に案内する（今なにをすればいいか、押すと何が起きるか、次にいつ戻ってくるか）
- 責めない: うまくいかなかった時は利用者のせいにせず、ひとこと詫びて、代わりの道を添える
- 待たせない・迷わせない: 処理中は、今なにをしているかを言葉で伝える
- 押し付けない: 答えをすぐ見せず、自分で考える余白を渡してから確かめられるようにする（例: 技法を宣言 → 自分で探す → 確かめる）
- お金に誠実: Geminiなど費用がかかる操作は、押す前にそう伝える。一度作ったものは保存して、二度と課金しない

## 構成

静的サイト（`index.html` がハブ）から4つのアプリへ遷移する:

- `Chat.html` — Gemini対話（Titan Chat）
- `ReviewViewer.html` — Daily/Weekly/Monthly/Yearlyの蒸留レポート
- `Timeline_Viewer.html` — 感情スコアの時系列グラフ
- `Synapse_Graph.html` — 階層をまたぐ伏線（synapse_link）のネットワーク可視化

いずれも `settings.js` 経由でユーザーのGAS Web AppのURLを読み、そこにデータを取りに行く。GASのサーバー側コードはこのリポジトリには含まれない。Rikki本人のバックエンドは AI_Partner_Sync_OS の `1_System_Core/gas_src/ai_partner_sync_engine/`（clasp管理・`clasp push` → `clasp deploy -i <既存ID>` で本番URLを変えずに反映）で、`G_Timeline.js` の `doGet` が `?page=timeline_data` 等を返している。公開用フォーク `ai_partner_sync_master_sheet_public/` の `G_Timeline.js` は別物なので注意。

## 進行中の設計: 「想起エンジン」「意味編集エンジン」

2026-09-28のセッションで、Chat.htmlの会話体験とSynapse Graphの意味づけ体験を拡張する設計を行った。

- **①想起エンジン**（コーチングチャット）: 過去のUnfinished Businessの中から「今出すべき1件」を選び、NLP前提（欠如ではなく発見の視点）に基づくオープンクエスチョンで自然に会話へ挿入する。選定はスコアリング式（urgency / ripeness / context_fit）による。
- **②意味編集エンジン**（物語生成）: Synapse Graphで伏線が回収された瞬間に、4部構成（出来事・意味の再定義・学び・統合のための一歩）のミニチャプターをその場で生成する。`heaviness`（軽重）算出式に応じて、重いテーマには「菅ちゃんとのセッション」への導線（`https://rikkis-room.com/ja/briefing`）を提示する。

設計の全文（スコアリング式・プロンプトドラフト・データモデル拡張案・UIフロー図）はここにまとまっている:
**設計スペックドキュメント**: https://claude.ai/code/artifact/c6998cdc-6968-4173-88d0-c3850102eaa2

このスペックの一部（②のUIシェル）を `Synapse_Graph.html` に実装済み:
**PR #1**: https://github.com/AI-Partner-Sync/genesis-pipe-Master-V1/pull/1

実装済みの範囲: ノードタップで開くボトムシート型モーダル、4部構成表示、heavinessに応じたCTA出し分け、localStorageによる実践ログ。
2026-09-28 追加実装（本家GASのみ）: `I_MiniChapter.js` に `?page=mini_chapter`（生成＋`MiniChapter`シートへのキャッシュ）、`?page=assign_themes`（Unfinished Businessへ`theme_id`付与→`Theme_Index`シート）、`?page=prewarm_chapters` を追加。`timeline_data` の各エントリに `theme_id` / `occurrence_count`（同テーマが現れた週数）/ `days_open` / `heaviness` が載るようになり、フロントはそれを優先して使う。
※2026-10-27確認: `I_MiniChapter.js`・`J_Recall.js`・heaviness付与は、公開版テンプレートと栗山さん用にもすでに入っている（下記「GASの置き場所」参照）。

2026-10-27 追加: `reflection_stage.js`（振り返りステージの共通部品）。記録1件を「場面→一呼吸→一言→意味→声に出す」の全画面で体験し、ミルトンモデル19・スレイト・オブ・マウス16技法をエピソード記憶として覚える。`Timeline_Viewer.html` の各記録に「この日を振り返る」を付け、声に出せた振り返りは1日・3日・1週間・3週間後に「思い出す時期」として再表示する（記録は端末のlocalStorage `aps_reflection_log`）。一言はGASの `?page=reflection`（`I_Reflection.js`）で生成し、各スプレッドシートの `Reflection` タブにキャッシュする。GASに入っていない間は、記録の「」の言葉を技法の型にはめた「たとえば」で練習する。振り返り機能は `Timeline_Viewer.html#reflect=on` を開いた端末だけに表示する（栗山さんなど他の利用者の画面は変えない）。Synapse Graph・Chat.html（想起エンジン）からも `ApsReflection.open(entry)` で同じ部品を使う想定。

## GASの置き場所（2026-10-27確認）

GASのソースはGitHubではなく、Google Driveの `AI_Partner_Sync_OS/…/gas_src/`（Macと同期・gitでローカル管理）にある。3つともclasp管理で、Rikkiのパソコンから `clasp push` する。

- `ai_partner_sync_engine/` … 本家（Rikki本人のシート）
- `ai_partner_sync_master_sheet_public/` … 公開版テンプレート（`AI_Partner_Sync_Master_Sheet_for_Public`、配布用の原本）
- `kuri_master_sheet/` … 受講者・栗山さんのシート用（READMEに本番デプロイIDあり）。公開版を直したら、ここにも同じ修正が必要

複数のGASへ同じ機能を入れる時は `gas_src/_updates/<日付>_<機能>/` に更新キットを置き、Rikkiが `node apply_*.mjs <対象>` で1つずつ反映する（例: `2026-10-28_reflection/`）。

振り返りステージ・思い出す時期の通知・デジタル知識脳の構想の仕様書（正本）は、Driveの `仕様書/GenesisPipe_振り返りステージ_デジタル知識脳_仕様書.md`。2026-10-28時点の未完了は、Discordの6人のQI（Macの `qi-bots.js`）がHQの頭脳APIで401になり返事できない件（仕様書8章）。

新しいセッションでこの続きに取り組む場合は、まず上記スペックドキュメントとPRを読むこと。
