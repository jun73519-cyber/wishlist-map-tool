/**
 * 場所(places)の保存先まわりの共有定義（クライアント側）。
 *
 * 旧: ブラウザの localStorage に保存していた。
 * 新: データベース(Neon) に保存する。読み書きは `/api/places`、リセットは
 *     `/api/places/reset` 経由で行う（SQL や接続文字列はサーバー側だけが扱う）。
 *     保存先を切り替えた理由は `lib/db.ts` の冒頭コメントを参照。
 */

/**
 * 保存内容を消して初期サンプル（data/candidates.json）に戻す。
 * 「サンプルデータに戻す」ボタンから呼ぶ。サーバーで DB をリセットしてから
 * reload し、初期サンプルを読み直す。
 */
export async function resetToSeedData() {
  try {
    await fetch("/api/places/reset", { method: "POST" });
  } catch {
    // 通信に失敗しても reload は試みる
  }
  location.reload();
}
