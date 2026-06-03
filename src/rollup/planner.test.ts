import { describe, expect, it } from "vitest";
import {
  buildRollupColumnValues,
  hashSourceItem,
  planRollupOperations,
  sourceKey
} from "./planner";
import type { ItemMapping, RollupColumn, RollupConfig, SourceBoard } from "./types";

const sourceBoard: SourceBoard = {
  id: "100",
  name: "Client A",
  columns: [
    { id: "status", title: "Status", type: "status" },
    { id: "due", title: "Due Date", type: "date" },
    { id: "budget", title: "Budget", type: "numbers" }
  ],
  items: [
    {
      id: "item-1",
      name: "Launch page",
      values: {
        status: { id: "status", text: "Stuck", value: { label: "Stuck" }, type: "status" },
        due: { id: "due", text: "2026-06-01", value: { date: "2026-06-01" }, type: "date" },
        budget: { id: "budget", text: "1200", value: "1200", type: "numbers" }
      }
    }
  ]
};

const targetColumns: RollupColumn[] = [
  { id: "source_board", title: "Source Board", type: "text" },
  { id: "source_item", title: "Source Item", type: "link" },
  { id: "sync_hash", title: "Sync Hash", type: "text" },
  { id: "rollup_status", title: "Rollup Status", type: "status" },
  { id: "rollup_due", title: "Rollup Due", type: "date" },
  { id: "rollup_budget", title: "Rollup Budget", type: "numbers" }
];

const config: RollupConfig = {
  sourceBoardIds: ["100"],
  targetBoardId: "900",
  targetGroupId: "topics",
  sourceBoardColumnId: "source_board",
  sourceItemColumnId: "source_item",
  hashColumnId: "sync_hash",
  mirroredColumns: [
    { sourceTitle: "Status", rollupColumnId: "rollup_status" },
    { sourceTitle: "Due Date", rollupColumnId: "rollup_due" },
    { sourceTitle: "Budget", rollupColumnId: "rollup_budget" }
  ]
};

describe("sourceKey", () => {
  it("combines source board and item ids", () => {
    expect(sourceKey("100", "item-1")).toBe("100:item-1");
  });
});

describe("hashSourceItem", () => {
  it("changes when mirrored source values change", () => {
    const first = hashSourceItem(sourceBoard, sourceBoard.items[0], config);
    const changedBoard = {
      ...sourceBoard,
      items: [{
        ...sourceBoard.items[0],
        values: {
          ...sourceBoard.items[0].values,
          status: { id: "status", text: "Done", value: { label: "Done" }, type: "status" }
        }
      }]
    };

    expect(hashSourceItem(changedBoard, changedBoard.items[0], config)).not.toBe(first);
  });
});

describe("buildRollupColumnValues", () => {
  it("builds monday column values using target column types", () => {
    expect(buildRollupColumnValues({
      sourceBoard,
      sourceItem: sourceBoard.items[0],
      config,
      targetColumns,
      accountSlug: "radom-force"
    })).toEqual({
      source_board: "Client A",
      source_item: {
        url: "https://radom-force.monday.com/boards/100/pulses/item-1",
        text: "Launch page"
      },
      sync_hash: hashSourceItem(sourceBoard, sourceBoard.items[0], config),
      rollup_status: { label: "Stuck" },
      rollup_due: { date: "2026-06-01" },
      rollup_budget: 1200
    });
  });
});

describe("planRollupOperations", () => {
  it("creates missing rollup items, skips unchanged mapped items, and updates changed mapped items", () => {
    const currentHash = hashSourceItem(sourceBoard, sourceBoard.items[0], config);
    const unchanged: Record<string, ItemMapping> = {
      "100:item-1": { sourceBoardId: "100", sourceItemId: "item-1", rollupItemId: "rollup-1", hash: currentHash }
    };
    const stale: Record<string, ItemMapping> = {
      "100:item-1": { sourceBoardId: "100", sourceItemId: "item-1", rollupItemId: "rollup-1", hash: "old" }
    };

    expect(planRollupOperations({ sourceBoards: [sourceBoard], config, targetColumns, mappings: {}, accountSlug: "radom-force" })).toMatchObject({
      creates: [{ sourceBoardId: "100", sourceItemId: "item-1", itemName: "Client A - Launch page" }],
      updates: [],
      skips: []
    });
    expect(planRollupOperations({ sourceBoards: [sourceBoard], config, targetColumns, mappings: unchanged, accountSlug: "radom-force" }).skips).toEqual(["100:item-1"]);
    expect(planRollupOperations({ sourceBoards: [sourceBoard], config, targetColumns, mappings: stale, accountSlug: "radom-force" })).toMatchObject({
      creates: [],
      updates: [{ rollupItemId: "rollup-1", sourceKey: "100:item-1" }],
      skips: []
    });
  });
});
