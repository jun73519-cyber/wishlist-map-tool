import { type NextRequest, NextResponse } from "next/server";
import { candidatesSchema } from "@/lib/schema";
import { readPlaces, writePlaces } from "@/lib/db";

// DB アクセスは毎リクエスト実行する（キャッシュさせない）。Node ランタイムで動かす。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 場所(places)の取得・保存 API。
 *
 * GET  /api/places        → Candidate[]（DB の全件。空なら自動で初期サンプルを投入）
 * POST /api/places (body: Candidate[]) → クライアントの全件を DB に同期保存
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
  let body: unknown;
  try {
    body = await req.json();
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
