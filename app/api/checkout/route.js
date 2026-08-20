import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const PLAN_LABELS = {
  light: "ライト",
  standard: "スタンダード",
  patron: "パトロン",
};

function buildLineItems(items) {
  return items.map((it) => {
    const priceYen = Math.round(Number(it.priceYen));
    if (!Number.isFinite(priceYen) || priceYen <= 0 || priceYen > 1000000) {
      throw new Error("プランの金額が不正です");
    }
    const planLabel = PLAN_LABELS[it.plan] || String(it.plan ?? "");
    const templeName = String(it.name ?? "推し寺").slice(0, 80);
    const name = planLabel ? `${templeName}（${planLabel}プラン）` : templeName;

    return {
      quantity: 1,
      price_data: {
        currency: "jpy",
        unit_amount: priceYen,
        recurring: { interval: "month" },
        product_data: {
          name,
          metadata: {
            temple_id: String(it.id ?? ""),
            plan: String(it.plan ?? ""),
          },
        },
      },
    };
  });
}

async function createCheckoutSession({ secretKey, items, origin }) {
  const stripe = new Stripe(secretKey);
  const line_items = buildLineItems(items);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    line_items,
    success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/index.html`,
    locale: "ja",
    metadata: {
      temple_count: String(items.length),
    },
  });
}

// 診断用: キーの中身は返さず、形式だけをマスク表示で確認する
// ?selftest=1 を付けると、POSTと同じ createCheckoutSession() 経路で
// ¥100のダミーCheckout Sessionを1件作成し、Stripeへの疎通を検証する
// （作成されるのはリンクのみで、誰も決済しなければ何も起きない）
export async function GET(req) {
  const secretKey = process.env.STRIPE_SECRET_KEY || "";
  const looksValid = /^sk_(test|live)_[A-Za-z0-9]{10,}$/.test(secretKey);

  const url = new URL(req.url);
  if (url.searchParams.get("selftest") === "1") {
    if (!looksValid) {
      return NextResponse.json(
        { selftest: "skipped", reason: "STRIPE_SECRET_KEY not valid-looking" },
        { status: 500 }
      );
    }
    try {
      const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
      const session = await createCheckoutSession({
        secretKey,
        items: [
          {
            id: "selftest",
            name: "selftest（動作確認用・実際の支援には使わないでください）",
            plan: "light",
            priceYen: 100,
          },
        ],
        origin,
      });
      return NextResponse.json({ selftest: "ok", checkoutUrl: session.url });
    } catch (err) {
      return NextResponse.json(
        { selftest: "error", message: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    configured: secretKey.length > 0,
    looksValid,
    prefix: secretKey.slice(0, 8),
    tail: secretKey ? "****" + secretKey.slice(-4) : "",
    length: secretKey.length,
  });
}

export async function POST(req) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: "サーバー設定エラー: STRIPE_SECRET_KEY が未設定です" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const items = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "カートが空です" }, { status: 400 });
    }
    if (items.length > 50) {
      return NextResponse.json(
        { error: "一度に登録できる推し寺の数を超えています" },
        { status: 400 }
      );
    }

    const origin = req.headers.get("origin") || `https://${req.headers.get("host")}`;
    const session = await createCheckoutSession({ secretKey, items, origin });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout session creation failed", err);
    const message =
      err instanceof Error ? err.message : "チェックアウトの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
