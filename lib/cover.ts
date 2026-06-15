// 書影URLを高解像度版に整える。
// 楽天の書影は `..._ex=200x200` のように小さいサイズが埋め込まれていることが多く、
// PC表示で粗く見える。表示時にサイズ指定を大きい値へ書き換える（元URLは変えない）。
export function hiResCover(url: string | null | undefined, size = 400): string | null {
  if (!url) return null;
  // 楽天サムネイルの _ex=幅x高 を指定サイズに置換
  if (/_ex=\d+x\d+/.test(url)) {
    return url.replace(/_ex=\d+x\d+/, `_ex=${size}x${size}`);
  }
  // _ex 指定が無い楽天サムネイルには付与
  if (/thumbnail\.image\.rakuten\.co\.jp/.test(url)) {
    return url + (url.includes("?") ? "&" : "?") + `_ex=${size}x${size}`;
  }
  return url;
}
