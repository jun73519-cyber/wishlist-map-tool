/**
 * 場所(places)の保存先まわりの共有定義（クライアント側）。
 *
 * 旧: ブラウザの localStorage に保存していた。
 * 新: データベース(Neon) に保存する。読み書きは `/api/places`、リセットは
 *     `/api/places/reset` 経由で行う（SQL や接続文字列はサーバー側だけが扱う）。
 *     保存先を切り替えた理由は `lib/db.ts` の冒頭コメントを参照。
 *
 * 書き込み保護（合言葉）:
 *   サーバーに WRITE_TOKEN が設定されている場合、書き込み系 API は合言葉を要求する。
 *   合言葉は設定ダイアログで入力し、このブラウザの localStorage に保存する
 *   （閲覧は誰でも可・書き込みだけ保護、という運用のため）。
 */

const WRITE_TOKEN_KEY = "wishlist-map:writeToken";

/** 保存済みの合言葉を返す（未設定は ""）。 */
export function getWriteToken(): string {
  try {
    return localStorage.getItem(WRITE_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

/** 合言葉を保存する（空文字で削除）。 */
export function setWriteToken(token: string) {
  try {
    if (token) localStorage.setItem(WRITE_TOKEN_KEY, token);
    else localStorage.removeItem(WRITE_TOKEN_KEY);
  } catch {
    // localStorage が使えない環境では何もしない（毎回入力してもらう運用は不可）
  }
}

/** 書き込み系 fetch に付けるヘッダー。合言葉があれば x-write-token を足す。 */
export function writeHeaders(
  base: Record<string, string> = {},
): Record<string, string> {
  const token = getWriteToken();
  return token ? { ...base, "x-write-token": token } : base;
}

/**
 * 保存内容を消して初期サンプル（data/candidates.json）に戻す。
 * 「サンプルデータに戻す」ボタンから呼ぶ。サーバーで DB をリセットしてから
 * reload し、初期サンプルを読み直す。
 */
export async function resetToSeedData() {
  try {
    await fetch("/api/places/reset", {
      method: "POST",
      headers: writeHeaders(),
    });
  } catch {
    // 通信に失敗しても reload は試みる
  }
  location.reload();
}
