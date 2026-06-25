import { type NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { placeDraftSchema } from "@/lib/schema";

// Google GenAI SDK は Node ランタイムで動かす（Edge 不可）。
export const runtime = "nodejs";

/**
 * 場所の「AI下書き」生成 API（Google Gemini 版）。
 *
 * 入力: { name: string; url?: string }
 * 出力: { draft: PlaceDraft }（profile のキーに一致する 7 項目）/ { error: string }
 *
 * 規律:
 *   - API キーは環境変数（`.env.local` の `GEMINI_API_KEY`）からのみ参照。直書き禁止。
 *   - サーバー側でのみ呼ぶ（キーをクライアントに出さない）。
 *   - モデルは `GEMINI_MODEL`（既定 `gemini-2.5-flash`）。JSON モード
 *     （responseMimeType: application/json）+ システム指示で出力 JSON の形を固定し、
 *     `placeDraftSchema`（zod）で検証してから返す。
 *
 * UI 側（AddItemDialog / CandidateListPane）はプロバイダ非依存。`/api/draft-place`
 * の入出力契約さえ保てば、Anthropic ↔ Gemini の差し替えは本ファイルだけで完結する。
 */

const SYSTEM_INSTRUCTION =
  "あなたは旅行メモの下書きアシスタントです。指定された『行きたい場所』について、日本語で各フィールドを埋めてください。" +
  "事実が不確かな場合は一般的・無難な情報にとどめ、固有の数字や施設名を創作しないでください。" +
  "予算は日本からの旅行を想定したざっくりの目安を万円単位の数値のみで表してください（例: 5）。" +
  "確かなことが書けない項目は空文字にしてください。\n" +
  "出力は次の 7 キーだけを持つ JSON オブジェクトのみとし、前後に説明やコードフェンスを付けないでください:\n" +
  "- address: 所在地（国・地域・都市など）\n" +
  "- source: 情報源（SNS/雑誌/映画など。不明なら空文字）\n" +
  "- email: 公式サイトの URL（不明なら空文字）\n" +
  "- desiredSalaryMin: 旅費の目安・下限（万円単位の数値のみ。不明なら空文字）\n" +
  "- desiredSalaryMax: 旅費の目安・上限（万円単位の数値のみ。不明なら空文字）\n" +
  "- careerText: アクセス方法と見どころ（2〜5 行程度。改行可）\n" +
  "- motivationFull: この場所に行きたくなる理由（1〜3 文）\n" +
  "すべての値は文字列にしてください。";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY が未設定です。プロジェクト直下の .env.local に設定し、開発サーバーを再起動してください。",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です。" }, { status: 400 });
  }

  const input = body as { name?: unknown; url?: unknown };
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "場所名を入力してください。" }, { status: 400 });
  }

  const userText = url
    ? `行きたい場所: ${name}\n参考 URL（タイトルやドメインから手がかりにしてよい）: ${url}`
    : `行きたい場所: ${name}`;

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.7,
      },
    });

    const raw = (response.text ?? "").trim();
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "AI の出力を解釈できませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }
    const parsed = placeDraftSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "AI の出力が想定の形式と一致しませんでした。もう一度お試しください。" },
        { status: 502 },
      );
    }
    return NextResponse.json({ draft: parsed.data });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "AI の呼び出しに失敗しました。";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
