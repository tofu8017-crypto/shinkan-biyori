import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 問い合わせフォームの送信先。Supabaseの contacts テーブルに保存する。
// 公開フォームだが、挿入はサーバー側のサービスロールキーで行うため
// 匿名キーをブラウザに晒さずに済む（RLSは有効のままでよい）。
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { name, email, message, website } = body ?? {};

    // ハニーポット（人間には見えない website 欄が埋まっていたらbotとして無視）
    if (typeof website === "string" && website.trim() !== "") {
      return NextResponse.json({ ok: true });
    }

    if (typeof message !== "string" || message.trim().length < 5) {
      return NextResponse.json(
        { ok: false, error: "メッセージを5文字以上で入力してください。" },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return NextResponse.json(
        { ok: false, error: "サーバー設定が未完了です。時間をおいてお試しください。" },
        { status: 500 }
      );
    }

    const sb = createClient(url, key);
    const { error } = await sb.from("contacts").insert({
      name: typeof name === "string" ? name.slice(0, 100) : "",
      email: typeof email === "string" ? email.slice(0, 200) : "",
      message: message.slice(0, 4000),
    });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
