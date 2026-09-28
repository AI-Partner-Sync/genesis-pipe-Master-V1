# Genesis Pipe (AI Partner Sync)

Google Apps Script（GAS）+ Gemini APIで動くAI伴走者チャット＆振り返りシステム。フレームワーク不使用のVanilla JS/HTML/CSS。詳細は `README.md` 参照。

## 構成

静的サイト（`index.html` がハブ）から4つのアプリへ遷移する:

- `Chat.html` — Gemini対話（Titan Chat）
- `ReviewViewer.html` — Daily/Weekly/Monthly/Yearlyの蒸留レポート
- `Timeline_Viewer.html` — 感情スコアの時系列グラフ
- `Synapse_Graph.html` — 階層をまたぐ伏線（synapse_link）のネットワーク可視化

いずれも `settings.js` 経由でユーザーのGAS Web AppのURLを読み、そこにデータを取りに行く。GASのサーバー側コード（`Code.gs`）はこのリポジトリには含まれない（README参照、GASエディタに手動で貼り付ける運用）。

## 進行中の設計: 「想起エンジン」「意味編集エンジン」

2026-09-28のセッションで、Chat.htmlの会話体験とSynapse Graphの意味づけ体験を拡張する設計を行った。

- **①想起エンジン**（コーチングチャット）: 過去のUnfinished Businessの中から「今出すべき1件」を選び、NLP前提（欠如ではなく発見の視点）に基づくオープンクエスチョンで自然に会話へ挿入する。選定はスコアリング式（urgency / ripeness / context_fit）による。
- **②意味編集エンジン**（物語生成）: Synapse Graphで伏線が回収された瞬間に、4部構成（出来事・意味の再定義・学び・統合のための一歩）のミニチャプターをその場で生成する。`heaviness`（軽重）算出式に応じて、重いテーマには「菅ちゃんとのセッション」への導線（`https://rikkis-room.com/ja/briefing`）を提示する。

設計の全文（スコアリング式・プロンプトドラフト・データモデル拡張案・UIフロー図）はここにまとまっている:
**設計スペックドキュメント**: https://claude.ai/code/artifact/c6998cdc-6968-4173-88d0-c3850102eaa2

このスペックの一部（②のUIシェル）を `Synapse_Graph.html` に実装済み:
**PR #1**: https://github.com/AI-Partner-Sync/genesis-pipe-Master-V1/pull/1

実装済みの範囲: ノードタップで開くボトムシート型モーダル、4部構成表示、heavinessに応じたCTA出し分け、localStorageによる実践ログ。
未実装（次にやること）: GASバックエンド側の `page=mini_chapter` エンドポイント（②のプロンプトをGeminiに投げて実際に生成する部分）、Oracleエンジンへの `theme_id` タグ付け追加（`occurrence_count` の実装に必要）。

新しいセッションでこの続きに取り組む場合は、まず上記スペックドキュメントとPRを読むこと。
