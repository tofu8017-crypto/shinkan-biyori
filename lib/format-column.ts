// コラム本文の可読性を表示時に補正する。
// 既存記事のbody_htmlは「1段落300字超・太字ゼロ」の壁テキストが多いため、
// DBを書き換えずレンダリング時に整形する（新規記事はプロンプト側でも改善済み）。
export function formatColumnBody(html: string): string {
  return html.replace(/<p>([\s\S]*?)<\/p>/g, (whole, inner: string) => {
    // 長い段落を「。」区切りで150字目安のかたまりに分割する
    let paragraphs: string[];
    if (inner.length > 200) {
      const sentences = inner.split(/(?<=。)/);
      paragraphs = [];
      let current = "";
      for (const s of sentences) {
        current += s;
        if (current.length >= 150) {
          paragraphs.push(current);
          current = "";
        }
      }
      if (current) paragraphs.push(current);
    } else {
      paragraphs = [inner];
    }
    // 各段落の最初の『書名』を太字にする（既に<strong>があればその段落は触らない）
    // ponytail: 『』がaタグをまたぐケースは[^』<]で除外。凝った対応が要るほど頻出しない
    return paragraphs
      .map((p) => {
        if (p.includes("<strong")) return `<p>${p}</p>`;
        return `<p>${p.replace(/『([^』<]{1,50})』/, "<strong>『$1』</strong>")}</p>`;
      })
      .join("");
  });
}
