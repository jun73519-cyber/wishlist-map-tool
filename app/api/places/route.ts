import { type NextRequest, NextResponse } from "next/server";
import { candidatesSchema } from "@/lib/schema";
import { readPlaces, writePlaces } from "@/lib/db";
import { isWriteAuthorized } from "@/lib/write-guard";

// DB アクセスは毎リクエスト実行する（キャッシュさせない）。Node ランタイムで動かす。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST ボディの上限（base64 写真込みの全件同期を想定しつつ、巨大ペイロードによる
// DB 肥大・転送コスト攻撃を防ぐ）。
const MAX_BODY_BYTES = 5 * 1024 * 1024;

/**
 * 場所(places)の取得・保存 API。
 *
 * GET  /api/places        → Candidate[]（DB の全件。空なら自動で初期サンプルを投入）
 * POST /api/places (body: Candidate[]) → クライアントの全件を DB に同期保存
 *      WRITE_TOKEN 設定時は合言葉必須（lib/write-guard.ts）。
 *
 * クライアント（Workspace.tsx）は localStorage の代わりにこの API を読み書きする。
 */
export async function GET() {
  try {
    const places = await readPlaces();
    return NextResponse.json(places);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "場所の読み込みに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json(
      { error: "編集の合言葉が違います。設定画面で合言葉を入力してください。" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "データが大きすぎます（写真の枚数やサイズを減らしてください）。" },
        { status: 413 },
      );
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const parsed = candidatesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "場所データの形式が想定と一致しません。" },
      { status: 400 },
    );
  }

  try {
    await writePlaces(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "場所の保存に失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
