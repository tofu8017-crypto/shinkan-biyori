import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// アフィリエイトリンクのクリックを click_events に記録する。
// クライアント（ClickTracker）から navigator.sendBeacon で叩かれる想定。
// 公開導線だが挿入はサーバー側のservice_roleで行い、匿名キーを晒さない。
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const store = body?.store === "rakuten" || body?.store === "amazon" ? body.store : null;
    if (!store) return NextResponse.json({ ok: true }); // 対象外は黙って無視

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ ok: true });

    const isbn13 =
      typeof body.isbn13 === "string" && /^\d{13}$/.test(body.isbn13) ? body.isbn13 : null;
    const page = typeof body.page === "string" ? body.page.slice(0, 200) : null;

    const sb = createClient(url, key);
    await sb.from("click_events").insert({ isbn13, store, page });
    return NextResponse.json({ ok: true });
  } catch {
    // 計測失敗はユーザー体験に影響させない
    return NextResponse.json({ ok: true });
  }
}
