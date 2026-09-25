# 鬼パーク
パステルレッドの、メンバー限定の鬼ごっこ企画ノート。

## 構成
- GitHub Pages: 入園画面・投稿画面などの公開用ファイル
- Cloudflare Worker + D1: 認証・投稿保存
- 投稿内容や合言葉はGitHubリポジトリに保存しません。
- サイトの枠や入園画面は誰でも取得できます。企画の読み取り・投稿APIは認証必須です。
- 参加者: 合言葉で閲覧・新規投稿。投稿者名は自己申告で、個人の本人確認はしません。
- オーナー: 別のパスワードでログイン。全投稿の編集・削除、進捗変更、合言葉変更。
- 合言葉変更で参加者のセッションを失効。オーナーは1時間、参加者は7日が上限。ブラウザのタブを閉じるとログイン情報は失われます。
- かな入力はNFC正規化して照合。参加者の入力欄は目隠しなしです。

## 公開手順（新規リポジトリ）
このフォルダの中身だけを新しいGitHubリポジトリ `oni-park` に置いてください。オニWorksのリポジトリには混ぜません。

1. Cloudflareアカウントを用意し、D1でデータベース `oni-park` を作成。
2. データベースIDを `wrangler.jsonc` の `database_id` に記入。
3. GitHubリポジトリのActions Secretsに `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録。トークンには対象アカウントのWorkers Scripts編集とD1編集権限が必要です。
4. Actionsの「鬼パーク 認証・投稿サーバー公開」を手動実行。テーブル作成とAPI公開が行われます。
5. CloudflareのWorkers画面で `oni-park-api` を開き、Settings > Variables and Secretsで **Secret** として `OWNER_PASSWORD` を追加。十分長い自分専用のパスワードを設定してデプロイしてください。コードやチャットには貼りません。
6. Workerの公開URLを `public/config.js` の `API_URL` に記入（末尾の / は不要）。
7. GitHub Settings > Pages > Sourceを **GitHub Actions** に設定。「鬼パーク サイト公開」を実行。
8. 公開サイトの「オーナーとしてログイン」から入園。「オーナー設定」で8文字以上の参加者用合言葉を設定。
9. 参加者にはサイトURLと参加者用合言葉を伝えてください。オーナーパスワードは伝えません。

GitHubユーザー名を変える場合は `wrangler.jsonc` の `ALLOWED_ORIGIN` をそのGitHub Pagesのオリジン（例 https://example.github.io）に変更してAPIを再公開します。

## 開発・確認
Node.js 22以降で `npm install`、`npm test`。
APIのローカル動作には `npm run db:local` と `npm run dev` を使います。
`.dev.vars` に OWNER_PASSWORD と ALLOWED_ORIGIN（例 http://localhost:8766）を設定してください。
publicを別のローカルHTTPサーバーで開き、config.jsのAPI_URLを http://localhost:8787 に設定します。本番公開前に戻してください。
未設定時は「公開準備中」と表示し、サンプル認証で通す機能はありません。

## 初期データ
本番の投稿は空から始めます。会話内の企画は以下を投稿すると整理しやすくなります。
- 実施済み: コナン鬼ごっこ、美術館鬼ごっこ、日本人形鬼ごっこ
- 検討案: 天狗、巨大かかし、海賊、恐竜、雪女、雷神、巨大掃除機、夜の遊園地、河童、巨大だるま
本文を公開リポジトリに埋め込まず、認証後の投稿フォームから登録してください。

## 制限
画像添付・個別アカウント・自動生成は初版には含みません。投稿の編集・削除はオーナーのみです。
実運用の通信・認証・データ保存確認はCloudflareとGitHubの設定後に実施してください。
