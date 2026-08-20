# OSHIDERA（推し寺）— デモサイト + Stripe連携

寺社仏閣の文化財修復を月額支援で応援するコンセプトの、Stripeテストモード決済つきデモアプリです。

## 構成

- `public/index.html` — メインのランディングページ（フロントエンドは静的HTML/CSS/JS）
- `public/success.html` — Stripe Checkout成功後のサンクスページ
- `app/api/checkout/route.ts` — 「まとめてカート」の内容からStripe Checkout Sessionを作成するAPI
- `next.config.js` — `/` を `public/index.html` にリライト

## 環境変数

| キー | 用途 |
|---|---|
| `STRIPE_SECRET_KEY` | Stripeテストモードのシークレットキー（`sk_test_...`） |

## 決済の仕組み

「まとめてカート」で選んだ寺社×プランの内容を `/api/checkout` にPOSTすると、Stripe Checkout Sessionを
`mode: "subscription"` で作成し、選択内容ごとに `price_data` で動的に行を積んだ1回のCheckoutにまとめます。
決済完了後は `success.html` にリダイレクトします。

テストカード: `4242 4242 4242 4242`（有効期限・CVCは任意の未来日・3桁でOK）。実際の課金は発生しません。

## 更新について

このリポジトリを更新する場合は、clone → 修正 → push（Vercelが自動で再デプロイ）が基本の流れです。
Vercelプロジェクトの再作成は行わないでください（同名プロジェクトの重複が発生します）。
