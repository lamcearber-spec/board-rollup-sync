import type { RollupColumn, SourceBoard } from "./rollup/types";

export const fixtureSourceBoards: SourceBoard[] = [
  {
    id: "100",
    name: "Client A Delivery",
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
  },
  {
    id: "101",
    name: "Client B Delivery",
    columns: [
      { id: "status", title: "Status", type: "status" },
      { id: "due", title: "Due Date", type: "date" },
      { id: "budget", title: "Budget", type: "numbers" }
    ],
    items: [
      {
        id: "item-2",
        name: "CRM cleanup",
        values: {
          status: { id: "status", text: "Working on it", value: { label: "Working on it" }, type: "status" },
          due: { id: "due", text: "2026-06-12", value: { date: "2026-06-12" }, type: "date" },
          budget: { id: "budget", text: "900", value: "900", type: "numbers" }
        }
      }
    ]
  }
];

export const fixtureTargetColumns: RollupColumn[] = [
  { id: "source_board", title: "Source Board", type: "text" },
  { id: "source_item", title: "Source Item", type: "link" },
  { id: "sync_hash", title: "Sync Hash", type: "text" },
  { id: "rollup_status", title: "Rollup Status", type: "status" },
  { id: "rollup_due", title: "Rollup Due", type: "date" },
  { id: "rollup_budget", title: "Rollup Budget", type: "numbers" }
];
