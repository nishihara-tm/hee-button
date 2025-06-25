# へぇボタン - リアルタイムクリックカウンター

Cloudflare Workers と Durable Objects を使用した、リアルタイムで同期されるマルチユーザー対応のクリックカウンターアプリケーションです。

## 🎯 機能

- **リアルタイム同期**: WebSocket を使用して、全ユーザーのクリック数が即座に同期されます
- **マルチユーザー対応**: 各ユーザーに固有のボタンが表示され、個別にクリック数をカウント
- **永続化**: Durable Objects でクリック数を保存し、リロードしても数値が保持されます
- **自動ユーザー識別**: Cookie を使用してユーザーを自動的に識別

## 🚀 デモ

[https://toy-box.YOUR-SUBDOMAIN.workers.dev/](https://toy-box.YOUR-SUBDOMAIN.workers.dev/)

## 📸 スクリーンショット

複数のユーザーがアクセスすると、それぞれのボタンとクリック数が表示されます：
- 自分のボタン: クリック可能（青色でハイライト）
- 他のユーザーのボタン: クリック不可（グレーアウト）

## 🛠️ 技術スタック

- **Cloudflare Workers**: エッジコンピューティングプラットフォーム
- **Durable Objects**: 状態を持つサーバーレスコンピューティング
- **WebSocket**: リアルタイム双方向通信
- **TypeScript**: 型安全な開発
- **Wrangler**: Cloudflare Workers の開発・デプロイツール

## 📋 必要な環境

- Node.js 16.x 以上
- npm または yarn
- Cloudflare アカウント（無料プランでも動作可能）

## 🏃‍♂️ ローカル開発

1. **リポジトリのクローン**
```bash
git clone https://github.com/YOUR-USERNAME/toy-box.git
cd toy-box
```

2. **依存関係のインストール**
```bash
npm install
```

3. **開発サーバーの起動**
```bash
npm run dev
```

4. **ブラウザでアクセス**
```
http://localhost:8787/
```

## 🚀 デプロイ

1. **Cloudflare にログイン**
```bash
npx wrangler login
```

2. **デプロイ実行**
```bash
npm run deploy
```

### 無料プランでのデプロイ

このプロジェクトは Cloudflare の無料プランでも動作するように、SQLite ベースの Durable Objects を使用しています。

## 📁 プロジェクト構成

```
toy-box/
├── src/
│   └── index.ts          # メインのWorkerとDurable Objectsの実装
├── public/
│   └── index.html        # へぇボタンのUIページ（メインページ）
├── test/
│   └── index.spec.ts     # テストファイル
├── wrangler.jsonc        # Cloudflare Workers の設定
├── package.json          # プロジェクトの依存関係
└── tsconfig.json         # TypeScriptの設定
```

## 🔧 API エンドポイント

- `GET /` - へぇボタンのUIページ（メインページ）
- `GET /counter` - ユーザー別カウンターAPI（Cookie認証）
- `WebSocket /websocket` - リアルタイム通信用のWebSocketエンドポイント

## 📝 WebSocket メッセージプロトコル

### クライアント → サーバー

```javascript
// 初期化リクエスト
{ "type": "init" }

// クリックイベント
{ "type": "click" }
```

### サーバー → クライアント

```javascript
// 初期状態
{
  "type": "init",
  "users": [{ "uid": "xxx", "clicks": 10 }],
  "currentUid": "xxx"
}

// クリック更新
{
  "type": "update",
  "uid": "xxx",
  "clicks": 11
}

// ユーザー参加
{
  "type": "user_joined",
  "uid": "xxx",
  "clicks": 0
}

// ユーザー離脱
{
  "type": "user_left",
  "uid": "xxx"
}
```

## 🧪 テスト

```bash
npm test
```

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 新しいブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## 📄 ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。

## 🙏 謝辞

- [Cloudflare Workers](https://workers.cloudflare.com/) - エッジコンピューティングプラットフォーム
- [Durable Objects](https://developers.cloudflare.com/workers/learning/using-durable-objects/) - ステートフルなサーバーレス機能

---

Created with ❤️ using Cloudflare Workers