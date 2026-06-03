import type { RollupColumn, SourceBoard, SourceColumn, SourceItem, SourceValue } from "../rollup/types";
import type { RollupApi } from "../rollup/executor";

export type MondayApi = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<{ data?: unknown; errors?: Array<{ message?: string }> }>;

type ApiColumn = {
  id: string;
  title: string;
  type: string;
};

type ApiColumnValue = {
  id: string;
  text?: string | null;
  value?: unknown;
  type?: string | null;
};

type ApiItem = {
  id: string;
  name: string;
  column_values: ApiColumnValue[];
};

type ApiItemsPage = {
  cursor?: string | null;
  items: ApiItem[];
};

type ApiBoard = {
  id: string;
  name: string;
  columns: ApiColumn[];
  items_page?: ApiItemsPage;
};

function dataRecord(response: { data?: unknown; errors?: Array<{ message?: string }> }): Record<string, unknown> {
  if (response.errors?.length) {
    throw new Error(response.errors.map((error) => error.message ?? "monday API error").join("; "));
  }

  if (!response.data || typeof response.data !== "object") {
    throw new Error("monday API returned no data.");
  }

  return response.data as Record<string, unknown>;
}

function parseColumnValue(raw: unknown): unknown {
  if (typeof raw !== "string") {
    return raw;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function normalizeValues(values: ApiColumnValue[]): Record<string, SourceValue> {
  return Object.fromEntries(values.map((value) => [
    value.id,
    {
      id: value.id,
      text: value.text ?? "",
      value: parseColumnValue(value.value),
      type: value.type ?? ""
    }
  ]));
}

function normalizeItem(item: ApiItem): SourceItem {
  return {
    id: item.id,
    name: item.name,
    values: normalizeValues(item.column_values)
  };
}

function normalizeColumns(columns: ApiColumn[]): SourceColumn[] {
  return columns.map((column) => ({
    id: column.id,
    title: column.title,
    type: column.type
  }));
}

function firstBoard(data: Record<string, unknown>): ApiBoard {
  const boards = data.boards;
  if (!Array.isArray(boards) || !boards[0]) {
    throw new Error("Board was not found or access is missing.");
  }

  return boards[0] as ApiBoard;
}

export async function fetchBoard(api: MondayApi, boardId: string, limit = 100): Promise<SourceBoard> {
  const firstPage = dataRecord(await api(`
    query SourceBoard($boardId: [ID!]!, $limit: Int!) {
      boards(ids: $boardId) {
        id
        name
        columns { id title type }
        items_page(limit: $limit) {
          cursor
          items {
            id
            name
            column_values { id text value type }
          }
        }
      }
    }
  `, { variables: { boardId: [boardId], limit } }));
  const board = firstBoard(firstPage);
  const items = [...(board.items_page?.items ?? []).map(normalizeItem)];
  let cursor = board.items_page?.cursor ?? null;

  while (cursor) {
    const nextPage = dataRecord(await api(`
      query NextItems($cursor: String!, $limit: Int!) {
        next_items_page(cursor: $cursor, limit: $limit) {
          cursor
          items {
            id
            name
            column_values { id text value type }
          }
        }
      }
    `, { variables: { cursor, limit } }));
    const next = nextPage.next_items_page as ApiItemsPage;
    items.push(...next.items.map(normalizeItem));
    cursor = next.cursor ?? null;
  }

  return {
    id: board.id,
    name: board.name,
    columns: normalizeColumns(board.columns),
    items
  };
}

export async function fetchBoardColumns(api: MondayApi, boardId: string): Promise<RollupColumn[]> {
  const data = dataRecord(await api(`
    query TargetBoardColumns($boardId: [ID!]!) {
      boards(ids: $boardId) {
        id
        columns { id title type }
      }
    }
  `, { variables: { boardId: [boardId] } }));
  return firstBoard(data).columns.map((column) => ({
    id: column.id,
    title: column.title,
    type: column.type
  }));
}

export function createMondayRollupApi(api: MondayApi): RollupApi {
  return {
    async createItem(input) {
      const data = dataRecord(await api(`
        mutation CreateRollupItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
          create_item(
            board_id: $boardId,
            group_id: $groupId,
            item_name: $itemName,
            column_values: $columnValues
          ) {
            id
          }
        }
      `, {
        variables: {
          boardId: input.boardId,
          groupId: input.groupId,
          itemName: input.itemName,
          columnValues: JSON.stringify(input.columnValues)
        }
      }));
      const created = data.create_item as { id?: string };
      if (!created.id) {
        throw new Error("monday did not return the created rollup item id.");
      }

      return created.id;
    },
    async updateItem(input) {
      dataRecord(await api(`
        mutation UpdateRollupItem($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(
            board_id: $boardId,
            item_id: $itemId,
            column_values: $columnValues
          ) {
            id
          }
        }
      `, {
        variables: {
          boardId: input.boardId,
          itemId: input.itemId,
          columnValues: JSON.stringify(input.columnValues)
        }
      }));
    }
  };
}
