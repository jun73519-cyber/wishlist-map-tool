/**
 * 書き込み系 API の合言葉ガード（サーバー側）。
 *
 * 公開 URL は認証なし＝誰でも書き込めるため、環境変数 `WRITE_TOKEN` を設定すると
 * 場所の保存・リセットに合言葉が必要になる（閲覧 GET は誰でも可のまま）。
 * 未設定なら従来どおり書き込み自由（ローカル開発の既定）。
 *
 * 合言葉の受け口は 2 つ:
 *   - ヘッダー `x-write-token`（通常の fetch）
 *   - クエリ `?token=`（sendBeacon はヘッダーを付けられないため）
 */
import { type NextRequest } from "next/server";

export function isWriteAuthorized(req: NextRequest): boolean {
  const token = process.env.WRITE_TOKEN;
  if (!token) return true;
  const provided =
    req.headers.get("x-write-token") ??
    req.nextUrl.searchParams.get("token") ??
    "";
  return provided === token;
}
