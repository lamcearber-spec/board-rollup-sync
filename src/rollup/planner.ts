import type {
  ItemMapping,
  RollupColumn,
  RollupConfig,
  RollupPlan,
  SourceBoard,
  SourceItem,
  SourceValue
} from "./types";

type BuildValuesArgs = {
  sourceBoard: SourceBoard;
  sourceItem: SourceItem;
  config: RollupConfig;
  targetColumns: RollupColumn[];
  accountSlug?: string;
};

type PlanArgs = {
  sourceBoards: SourceBoard[];
  config: RollupConfig;
  targetColumns: RollupColumn[];
  mappings: Record<string, ItemMapping>;
  accountSlug?: string;
};

export function sourceKey(sourceBoardId: string, sourceItemId: string): string {
  return `${sourceBoardId}:${sourceItemId}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`)
    .join(",")}}`;
}

function shortHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function valueByColumnTitle(sourceBoard: SourceBoard, sourceItem: SourceItem, title: string): SourceValue | undefined {
  const column = sourceBoard.columns.find((candidate) => candidate.title.toLowerCase() === title.toLowerCase());
  return column ? sourceItem.values[column.id] : undefined;
}

function targetColumn(targetColumns: RollupColumn[], columnId: string): RollupColumn | undefined {
  return targetColumns.find((column) => column.id === columnId);
}

function primitiveText(value: SourceValue | undefined): string {
  return value?.text.trim() ?? "";
}

function dateText(value: SourceValue | undefined): string {
  const text = primitiveText(value);
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : text;
}

function numericText(value: SourceValue | undefined): number | string {
  const text = primitiveText(value).replace(/,/g, "");
  const number = Number(text);
  return Number.isFinite(number) && text !== "" ? number : primitiveText(value);
}

function mondayValueForTarget(value: SourceValue | undefined, target: RollupColumn | undefined): unknown {
  const text = primitiveText(value);
  if (!target) {
    return text;
  }

  if (target.type === "status" || target.type === "dropdown") {
    return text ? { label: text } : null;
  }

  if (target.type === "date") {
    const date = dateText(value);
    return date ? { date } : null;
  }

  if (target.type === "numbers") {
    return numericText(value);
  }

  return text;
}

function sourceItemUrl(sourceBoardId: string, itemId: string, accountSlug?: string): string {
  if (!accountSlug) {
    return `https://monday.com/boards/${sourceBoardId}/pulses/${itemId}`;
  }

  return `https://${accountSlug}.monday.com/boards/${sourceBoardId}/pulses/${itemId}`;
}

export function hashSourceItem(sourceBoard: SourceBoard, sourceItem: SourceItem, config: RollupConfig): string {
  const mirrored = config.mirroredColumns.map((mapping) => ({
    sourceTitle: mapping.sourceTitle,
    value: valueByColumnTitle(sourceBoard, sourceItem, mapping.sourceTitle)?.text ?? ""
  }));

  return shortHash(stableStringify({
    sourceBoardId: sourceBoard.id,
    sourceItemId: sourceItem.id,
    itemName: sourceItem.name,
    mirrored
  }));
}

export function buildRollupColumnValues({
  sourceBoard,
  sourceItem,
  config,
  targetColumns,
  accountSlug
}: BuildValuesArgs): Record<string, unknown> {
  const hash = hashSourceItem(sourceBoard, sourceItem, config);
  const values: Record<string, unknown> = {
    [config.sourceBoardColumnId]: sourceBoard.name,
    [config.sourceItemColumnId]: {
      url: sourceItemUrl(sourceBoard.id, sourceItem.id, accountSlug),
      text: sourceItem.name
    },
    [config.hashColumnId]: hash
  };

  for (const mapping of config.mirroredColumns) {
    const sourceValue = valueByColumnTitle(sourceBoard, sourceItem, mapping.sourceTitle);
    values[mapping.rollupColumnId] = mondayValueForTarget(sourceValue, targetColumn(targetColumns, mapping.rollupColumnId));
  }

  return values;
}

export function planRollupOperations({
  sourceBoards,
  config,
  targetColumns,
  mappings,
  accountSlug
}: PlanArgs): RollupPlan {
  const plan: RollupPlan = { creates: [], updates: [], skips: [] };

  for (const sourceBoard of sourceBoards) {
    for (const sourceItem of sourceBoard.items) {
      const key = sourceKey(sourceBoard.id, sourceItem.id);
      const hash = hashSourceItem(sourceBoard, sourceItem, config);
      const mapped = mappings[key];

      if (mapped?.hash === hash) {
        plan.skips.push(key);
        continue;
      }

      const columnValues = buildRollupColumnValues({ sourceBoard, sourceItem, config, targetColumns, accountSlug });

      if (!mapped) {
        plan.creates.push({
          sourceBoardId: sourceBoard.id,
          sourceItemId: sourceItem.id,
          sourceKey: key,
          itemName: `${sourceBoard.name} - ${sourceItem.name}`,
          columnValues,
          hash
        });
        continue;
      }

      plan.updates.push({
        rollupItemId: mapped.rollupItemId,
        sourceBoardId: sourceBoard.id,
        sourceItemId: sourceItem.id,
        sourceKey: key,
        columnValues,
        hash
      });
    }
  }

  return plan;
}
