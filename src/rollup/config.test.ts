import { describe, expect, it } from "vitest";
import { parseBoardIds, parseColumnMappings } from "./config";

describe("parseBoardIds", () => {
  it("normalizes comma and whitespace separated board ids", () => {
    expect(parseBoardIds("123, 456\n789  456")).toEqual(["123", "456", "789"]);
  });

  it("rejects non-numeric board ids", () => {
    expect(() => parseBoardIds("123, board-two")).toThrow("Board IDs must be numeric");
  });
});

describe("parseColumnMappings", () => {
  it("parses source title to target column id mappings", () => {
    expect(parseColumnMappings("Status = rollup_status\nDue Date=due_date")).toEqual([
      { sourceTitle: "Status", rollupColumnId: "rollup_status" },
      { sourceTitle: "Due Date", rollupColumnId: "due_date" }
    ]);
  });

  it("rejects lines without an equals sign", () => {
    expect(() => parseColumnMappings("Status rollup_status")).toThrow("Use Source Title = target_column_id");
  });
});
