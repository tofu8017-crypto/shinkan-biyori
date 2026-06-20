import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext（Cloudflare）設定。最小構成で開始する。
// ISRの永続キャッシュ(R2/KV)は後から追加できる（無くてもページは再生成で動く）。
export default defineCloudflareConfig({});
