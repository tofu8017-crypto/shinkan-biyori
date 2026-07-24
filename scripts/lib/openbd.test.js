// 最小の自己チェック: node scripts/lib/openbd.test.js （ネットワーク不要）
const assert = require("assert");
const { pickDescription, cleanDescription, pickPrice } = require("./openbd");

// TextType 03(内容紹介) を優先し、HTMLと余分な空白を落とす
const item = {
  onix: {
    CollateralDetail: {
      TextContent: [
        { TextType: "02", Text: "著者コメント" },
        { TextType: "03", Text: "少女は<br>旅に出た。   その先で\n運命に出会う。" },
      ],
    },
    ProductSupply: { SupplyDetail: { Price: [{ PriceAmount: 1650 }] } },
  },
};
assert.strictEqual(pickDescription(item), "少女は 旅に出た。 その先で 運命に出会う。");
assert.strictEqual(pickPrice(item), "1650円");

// 内容紹介が無ければ空文字（=DB更新スキップ・表示は非表示）
assert.strictEqual(pickDescription({ onix: {} }), "");
assert.strictEqual(pickDescription(null), "");

// 500字超は文末(。)で切り詰め
const long = "あ。".repeat(400); // 800字、100字ごとに「。」
const cut = cleanDescription(long);
assert.ok(cut.length <= 501 && cut.endsWith("。"), `切り詰め異常: ${cut.length}`);

console.log("openbd.test.js: OK");
