import { describe, it, expect } from "vitest";
import { deriveStageStatus } from "@/lib/computed/scorecards";

// ステージ状態は「場所が Pane 2 でどこに居るか（currentStage）」から派生する。
// 旧 decision（ステータス: 行きたい/検討中/見送り）基準は撤去済み。
describe("deriveStageStatus", () => {
  it("現在位置と同じステージは done", () => {
    expect(deriveStageStatus("screening", "screening", "")).toBe("done");
    expect(deriveStageStatus("final", "final", "")).toBe("done");
  });

  it("現在位置より前のステージは done（通過済み）", () => {
    expect(deriveStageStatus("screening", "final", "")).toBe("done");
    expect(deriveStageStatus("first", "second", "2026-05-01")).toBe("done");
  });

  it("現在位置より先のステージは date があれば planned", () => {
    expect(deriveStageStatus("second", "first", "2026-05-01")).toBe("planned");
    expect(deriveStageStatus("final", "screening", "2026-12-01")).toBe(
      "planned",
    );
  });

  it("現在位置より先のステージで date が無ければ pending", () => {
    expect(deriveStageStatus("second", "first", "")).toBe("pending");
    expect(deriveStageStatus("final", "screening", "")).toBe("pending");
  });

  it("空白のみの date は空扱いで planned にならない", () => {
    expect(deriveStageStatus("second", "first", "  ")).toBe("pending");
  });
});
