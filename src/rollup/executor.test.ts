import { describe, expect, it } from "vitest";
import { executeRollupPlan } from "./executor";
import type { RollupPlan } from "./types";

describe("executeRollupPlan", () => {
  it("creates and updates rollup items while refreshing mappings", async () => {
    const calls: string[] = [];
    const plan: RollupPlan = {
      creates: [{
        sourceBoardId: "100",
        sourceItemId: "item-1",
        sourceKey: "100:item-1",
        itemName: "Client A - Launch page",
        columnValues: { source_board: "Client A" },
        hash: "hash-new"
      }],
      updates: [{
        rollupItemId: "rollup-2",
        sourceBoardId: "100",
        sourceItemId: "item-2",
        sourceKey: "100:item-2",
        columnValues: { source_board: "Client A" },
        hash: "hash-updated"
      }],
      skips: ["100:item-3"]
    };

    const result = await executeRollupPlan({
      plan,
      targetBoardId: "900",
      targetGroupId: "topics",
      mappings: {
        "100:item-2": {
          sourceBoardId: "100",
          sourceItemId: "item-2",
          rollupItemId: "rollup-2",
          hash: "old"
        }
      },
      api: {
        async createItem(input) {
          calls.push(`create:${input.boardId}:${input.groupId}:${input.itemName}:${input.columnValues.source_board}`);
          return "rollup-1";
        },
        async updateItem(input) {
          calls.push(`update:${input.boardId}:${input.itemId}:${input.columnValues.source_board}`);
        }
      }
    });

    expect(calls).toEqual([
      "create:900:topics:Client A - Launch page:Client A",
      "update:900:rollup-2:Client A"
    ]);
    expect(result.summary).toEqual({ created: 1, updated: 1, skipped: 1 });
    expect(result.mappings["100:item-1"]).toEqual({
      sourceBoardId: "100",
      sourceItemId: "item-1",
      rollupItemId: "rollup-1",
      hash: "hash-new"
    });
    expect(result.mappings["100:item-2"]?.hash).toBe("hash-updated");
  });
});
