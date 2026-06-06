import type { Book } from "@/types/book";

// en-CAロケールは "YYYY-MM-DD" 形式。timeZone指定で日本の暦日を正しく取得する
const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });

const yesterday = new Date(
  new Date(today).getTime() - 24 * 60 * 60 * 1000
)
  .toISOString()
  .slice(0, 10);

const twoDaysAgo = new Date(
  new Date(today).getTime() - 2 * 24 * 60 * 60 * 1000
)
  .toISOString()
  .slice(0, 10);

export const MOCK_BOOKS: Book[] = [
  {
    id: "1",
    isbn13: "9784103547501",
    isbn10: "4103547502",
    title: "春の庭にきみを待つ",
    author: "柴崎友香",
    publisher: "河出書房新社",
    published_date: today,
    genre_id: "001004008",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12345/",
    amazon_url: "https://www.amazon.co.jp/dp/4103547502",
    description: "日常の細部を丁寧に掬いとる柴崎友香の新作。ある春の午後、小さな庭で繰り広げられる静かな時間の物語。",
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "2",
    isbn13: "9784103524601",
    isbn10: "4103524604",
    title: "記憶の地図",
    author: "小川洋子",
    publisher: "新潮社",
    published_date: today,
    genre_id: "001004008",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12346/",
    amazon_url: "https://www.amazon.co.jp/dp/4103524604",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "3",
    isbn13: "9784087816549",
    isbn10: "4087816540",
    title: "夜の向こうの蛹たち",
    author: "辻村深月",
    publisher: "集英社",
    published_date: today,
    genre_id: "001004001",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12347/",
    amazon_url: "https://www.amazon.co.jp/dp/4087816540",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "4",
    isbn13: "9784150121075",
    isbn10: "4150121079",
    title: "星屑の歌声",
    author: "テッド・チャン",
    publisher: "早川書房",
    published_date: today,
    genre_id: "001004002",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12348/",
    amazon_url: "https://www.amazon.co.jp/dp/4150121079",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "5",
    isbn13: "9784163917504",
    isbn10: "4163917500",
    title: "日々のかけら、すこし",
    author: "岸本佐知子",
    publisher: "文藝春秋",
    published_date: today,
    genre_id: "001004003",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12349/",
    amazon_url: "https://www.amazon.co.jp/dp/4163917500",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "6",
    isbn13: "9784062937504",
    isbn10: "4062937506",
    title: "ゆうべの月",
    author: "川上弘美",
    publisher: "講談社",
    published_date: yesterday,
    genre_id: "001004008",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12350/",
    amazon_url: "https://www.amazon.co.jp/dp/4062937506",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "7",
    isbn13: "9784101092508",
    isbn10: "4101092508",
    title: "言葉の森をあるく",
    author: "三浦しをん",
    publisher: "新潮社",
    published_date: yesterday,
    genre_id: "001004003",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12351/",
    amazon_url: "https://www.amazon.co.jp/dp/4101092508",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
  {
    id: "8",
    isbn13: "9784488014506",
    isbn10: "4488014500",
    title: "氷の迷宮",
    author: "東野圭吾",
    publisher: "東京創元社",
    published_date: twoDaysAgo,
    genre_id: "001004001",
    image_url: null,
    rakuten_url: "https://books.rakuten.co.jp/rb/12352/",
    amazon_url: "https://www.amazon.co.jp/dp/4488014500",
    description: null,
    last_synced_at: new Date().toISOString(),
  },
];
