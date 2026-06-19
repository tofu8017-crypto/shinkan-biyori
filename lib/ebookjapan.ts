// ebookjapan（イーブックジャパン）アフィリエイトリンク生成。
//
// バリューコマースの「MyLink（ダイレクトリンク）」方式に対応した受け皿。
// トラッキングURL(ck.jp.ap.valuecommerce.com)で、ebookjapanの目的URLを vc_url に包む。
//
// ★有効化の手順:
//   1. バリューコマースに登録し ebookjapan と提携する
//   2. 発行された sid / pid を .env.local（とVercelの環境変数）に設定:
//        NEXT_PUBLIC_EBOOKJAPAN_VC_SID=...
//        NEXT_PUBLIC_EBOOKJAPAN_VC_PID=...
//   3. 設定すると全書籍カードに自動で「ebookjapan」ボタンが表示される
//
// sid/pid はURLに載る公開情報なので NEXT_PUBLIC_ で保持する
// （BookCardは一覧の絞り込み等でクライアント側でも描画されるため、両方で参照できる必要がある）。
const VC_SID = process.env.NEXT_PUBLIC_EBOOKJAPAN_VC_SID;
const VC_PID = process.env.NEXT_PUBLIC_EBOOKJAPAN_VC_PID;

type EbookLinkable = { title: string; isbn13?: string | null };

// ebookjapanはISBNでの商品直リンクが安定しないため、書名でのサイト内検索に飛ばす。
function ebookjapanSearchUrl(book: EbookLinkable): string {
  const kw = encodeURIComponent(book.title ?? "");
  return `https://ebookjapan.yahoo.co.jp/search/?keyword=${kw}`;
}

/**
 * ebookjapanのアフィリエイトURLを組み立てる。
 * sid/pid（バリューコマースの提携情報）が未設定なら null を返し、ボタンは表示されない。
 */
export function ebookjapanUrl(book: EbookLinkable): string | null {
  if (!VC_SID || !VC_PID) return null;
  const target = ebookjapanSearchUrl(book);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_PID}&vc_url=${encodeURIComponent(target)}`;
}
