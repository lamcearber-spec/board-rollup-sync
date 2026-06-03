import { describe, expect, it } from "vitest";
import { createMondayRollupApi, fetchBoard, fetchBoardColumns } from "./client";

describe("fetchBoard", () => {
  it("normalizes board data and follows next_items_page cursors", async () => {
    const queries: string[] = [];
    const api = async (query: string) => {
      queries.push(query);
      if (query.includes("next_items_page")) {
        return {
          data: {
            next_items_page: {
              cursor: null,
              items: [{
                id: "item-2",
                name: "Second",
                column_values: [{ id: "status", text: "Done", value: "{\"label\":\"Done\"}", type: "status" }]
              }]
            }
          }
        };
      }

      return {
        data: {
          boards: [{
            id: "100",
            name: "Source Board",
            columns: [{ id: "status", title: "Status", type: "status" }],
            items_page: {
              cursor: "next",
              items: [{
                id: "item-1",
                name: "First",
                column_values: [{ id: "status", text: "Stuck", value: "{\"label\":\"Stuck\"}", type: "status" }]
              }]
            }
          }]
        }
      };
    };

    await expect(fetchBoard(api, "100", 1)).resolves.toEqual({
      id: "100",
      name: "Source Board",
      columns: [{ id: "status", title: "Status", type: "status" }],
      items: [
        { id: "item-1", name: "First", values: { status: { id: "status", text: "Stuck", value: { label: "Stuck" }, type: "status" } } },
        { id: "item-2", name: "Second", values: { status: { id: "status", text: "Done", value: { label: "Done" }, type: "status" } } }
      ]
    });
    expect(queries.some((query) => query.includes("next_items_page"))).toBe(true);
  });
});

describe("fetchBoardColumns", () => {
  it("returns target board columns", async () => {
    const api = async () => ({
      data: {
        boards: [{
          id: "900",
          columns: [{ id: "source_board", title: "Source Board", type: "text" }]
        }]
      }
    });

    await expect(fetchBoardColumns(api, "900")).resolves.toEqual([
      { id: "source_board", title: "Source Board", type: "text" }
    ]);
  });
});

describe("createMondayRollupApi", () => {
  it("creates and updates items using JSON-stringified column values", async () => {
    const variables: unknown[] = [];
    const api = async (_query: string, options?: { variables?: Record<string, unknown> }) => {
      variables.push(options?.variables);
      if (options?.variables?.itemName) {
        return { data: { create_item: { id: "rollup-1" } } };
      }

      return { data: { change_multiple_column_values: { id: options?.variables?.itemId } } };
    };
    const rollupApi = createMondayRollupApi(api);

    await expect(rollupApi.createItem({
      boardId: "900",
      groupId: "topics",
      itemName: "Client A - Launch",
      columnValues: { source_board: "Client A" }
    })).resolves.toBe("rollup-1");
    await rollupApi.updateItem({
      boardId: "900",
      itemId: "rollup-1",
      columnValues: { source_board: "Client A" }
    });

    expect(variables).toEqual([
      {
        boardId: "900",
        groupId: "topics",
        itemName: "Client A - Launch",
        columnValues: "{\"source_board\":\"Client A\"}"
      },
      {
        boardId: "900",
        itemId: "rollup-1",
        columnValues: "{\"source_board\":\"Client A\"}"
      }
    ]);
  });
});
