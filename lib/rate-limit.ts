/**
 * AI 系 API ルート共通の簡易レート制限（IP ごと・スライディングウィンドウ）。
 *
 * 公開 URL で無認証のため、誰でも連打して Gemini の課金/クォータを燃やせるのを
 * 緩和する。サーバーレスではインスタンス単位のメモリなので厳密ではないが、
 * 素朴な乱用は十分に抑えられる。`/api/draft-place` と `/api/draft-itinerary` で共用。
 */
import { type NextRequest } from "next/server";

/** windowMs の間に max 回を超えたら true を返す判定関数を作る（ルートごとに独立カウント）。 */
export function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > max;
  };
}

export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff ? xff.split(",")[0]!.trim() : "unknown";
}
