import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripeの初期化（シークレットキーを使用）
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

export async function POST(req: Request) {
  try {
    // フロントエンドから「デポジット金額」と「ユーザーID」を受け取る
    const { amount, userId } = await req.json();

    if (!amount || amount < 3000) {
      return NextResponse.json(
        { error: 'デポジット金額は最低3000円以上で設定してください。' },
        { status: 400 }
      );
    }

    // 🔥 ここが極悪SaaSのキモ：「capture_method: 'manual'」
    // これにより、即時決済（引き落とし）ではなく、与信枠（Auth）の確保だけを行います。
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'jpy',
      capture_method: 'manual',
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic',
        },
      },
      metadata: {
        userId: userId,
        type: 'deposit_auth',
      },
    });

    // フロントエンドに「client_secret」を返す（これでフロント側でカード入力画面を出せる）
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id, // 後で没収（Capture）する時に使うID
    });

  } catch (error: any) {
    console.error('Stripe Auth Error:', error);
    return NextResponse.json(
      { error: error.message || '与信枠の確保に失敗しました。' },
      { status: 500 }
    );
  }
}
