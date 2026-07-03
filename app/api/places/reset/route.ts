import { type NextRequest, NextResponse } from "next/server";
import { resetPlaces } from "@/lib/db";
import { isWriteAuthorized } from "@/lib/write-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/places/reset
 * DB の場所をすべて消し、初期サンプル（data/candidates.json）に戻す。
 * 「サンプルデータに戻す」ボタンから呼ばれる。
 * WRITE_TOKEN 設定時は合言葉必須（全消しできる危険な操作のため）。
 */
export async function POST(req: NextRequest) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json(
      { error: "編集の合言葉が違います。設定画面で合言葉を入力してください。" },
      { status: 401 },
    );
  }
  try {
    const places = await resetPlaces();
    return NextResponse.json(places);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "サンプルへのリセットに失敗しました。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
