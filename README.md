# 🚀 Genesis Pipe

**AI Partner Sync — Google Apps Script × Gemini**

スマートフォンブラウザから使えるAI伴走者チャット＆会話ログシステムです。  
Google スプレッドシートに紐づいたGASウェブアプリとして動作します。

---

## 機能

- 💬 **AI対話モード** — Gemini APIを使ったリアルタイム会話
- 📝 **記録モード** — 会話ログをスプレッドシートへ自動保存
- 🔮 **Oracleエンジン** — 保存時にAIが自動タグ付け＆リフレーミング
- ⚗️ **蒸留レポート** — Daily / Weekly / Monthly / Yearly の自動まとめ
- ⏰ **時間トリガー対応** — GASのトリガー設定で夜間自動実行
- ⚙️ **パートナー設定** — ユーザー名・AI名をいつでも変更可能
- 🔥 **Firestore同期** — Firebase Firestoreへのリアルタイム連携（任意）
- 🎵 **BGM対応** — バックグラウンドミュージック ON/OFF

---

## セットアップ

### 1. Google スプレッドシートを作成

新しいスプレッドシートを作成します。

### 2. GASプロジェクトを作成

スプレッドシートのメニューから  
`拡張機能` → `Apps Script` を開き、以下のファイルを作成します：

| ファイル名 | 内容 |
|---|---|
| `Code.gs` | `Code.js` の内容を貼り付け |
| `index.html` | `index.html` の内容を貼り付け |

### 3. スクリプトプロパティを設定

GASエディタの `プロジェクトの設定` → `スクリプトプロパティ` に以下を追加：

| キー | 値 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio で取得したAPIキー |
| `FIREBASE_PROJECT_ID` | （任意）FirebaseプロジェクトID |
| `FIREBASE_CLIENT_EMAIL` | （任意）サービスアカウントのメール |
| `FIREBASE_PRIVATE_KEY` | （任意）サービスアカウントの秘密鍵 |
| `FIRESTORE_UID` | （任意）FirestoreのユーザーID |

### 4. ウェブアプリとしてデプロイ

GASエディタで `デプロイ` → `新しいデプロイ` →  
種類: **ウェブアプリ**、アクセス: **自分のみ** または **全員** でデプロイ。

発行された URL（`/exec` で終わる）をコピーします。

### 5. index.html のURLを更新

`index.html` の以下の行に、コピーしたURLを貼り付けます：

```javascript
const WEB_APP_URL = "YOUR_GAS_WEBAPP_URL"; // ← ここに貼り付け
```

### 6. 時間トリガーを設定（任意）

自動蒸留レポートを使う場合、GASのトリガーを設定します：

| 関数 | 推奨タイミング |
|---|---|
| `autoNightlyCheck` | 毎日 深夜0〜1時 |
| `autoDistillWeekly` | 毎週月曜 深夜 |

---

## パートナー設定

UIの ⚙️ボタン、またはスプレッドシートメニューの  
`🚀 Genesis Pipe` → `⚙️ パートナー設定` から  
**あなたの名前** と **AIの名前** をいつでも変更できます。

設定はGoogleアカウント単位で保存されます。

---

## 技術スタック

- Google Apps Script (GAS)
- Gemini API (`gemini-2.5-flash-lite`)
- Firebase Firestore（任意）
- Vanilla JS / HTML / CSS（フレームワーク不使用）

---

## License

MIT
