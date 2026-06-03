import type { ColumnMapping } from "./types";

export function parseBoardIds(input: string): string[] {
  const ids = input
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const invalid = ids.find((id) => !/^\d+$/.test(id));
  if (invalid) {
    throw new Error(`Board IDs must be numeric. Invalid value: ${invalid}`);
  }

  return Array.from(new Set(ids));
}

export function parseColumnMappings(input: string): ColumnMapping[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sourceTitle, rollupColumnId, ...rest] = line.split("=");
      if (!sourceTitle || !rollupColumnId || rest.length > 0) {
        throw new Error(`Use Source Title = target_column_id. Invalid line: ${line}`);
      }

      return {
        sourceTitle: sourceTitle.trim(),
        rollupColumnId: rollupColumnId.trim()
      };
    });
}
