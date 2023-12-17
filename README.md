# slack-zenn-rss-tracker

zenn に投稿された記事を user/publication 単位で監視して、投稿された際に slack に通知する bot です

# how to use

## slack app
1. https://api.slack.com/apps -> Create New App
2. From an app manifest 
3. slack-app-manifest.yml をコピペ
4. workspace にインストール

この際に以下をメモしておいてください
- Settings > Basic Information > App Credentials > Signing Secret
- Settings > Install App > Bot User OAuth Token
- 通知したい slack channel の ID

## cloudflare workers

1. `wrangler kv:namespace create KV`
2. wrangler.toml の kv_namespace を置換
3. `wrangler deploy`
4. 各種 secret を作成(前項でメモした値を使用します)
   1. wrangler secret put POST_CHANNEL_ID
   2. wrangler secret put SLACK_SIGNING_SECRET
   3. wrangler secret put SLACK_BOT_TOKEN


## 初期化

### publication 単位でまとめて初期化する場合

任意のチャンネルで `/add-watch-publication publication名` を実行してください
`Add Publication: ${publication名}, Users: [${ユーザ名}...] Successfully` が表示されたら OK です

### user 単位で初期化する場合
任意のチャンネルで `/add-watch-user ユーザ名` を実行してください
`Add User: ${ユーザ名} Successfully` が表示されたら OK です