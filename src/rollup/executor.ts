import type { ItemMapping, RollupPlan } from "./types";

export type RollupApi = {
  createItem(input: {
    boardId: string;
    groupId: string;
    itemName: string;
    columnValues: Record<string, unknown>;
  }): Promise<string>;
  updateItem(input: {
    boardId: string;
    itemId: string;
    columnValues: Record<string, unknown>;
  }): Promise<void>;
};

export type ExecuteRollupPlanArgs = {
  plan: RollupPlan;
  targetBoardId: string;
  targetGroupId: string;
  mappings: Record<string, ItemMapping>;
  api: RollupApi;
};

export async function executeRollupPlan({
  plan,
  targetBoardId,
  targetGroupId,
  mappings,
  api
}: ExecuteRollupPlanArgs): Promise<{
  mappings: Record<string, ItemMapping>;
  summary: { created: number; updated: number; skipped: number };
}> {
  const nextMappings: Record<string, ItemMapping> = { ...mappings };

  for (const create of plan.creates) {
    const rollupItemId = await api.createItem({
      boardId: targetBoardId,
      groupId: targetGroupId,
      itemName: create.itemName,
      columnValues: create.columnValues
    });
    nextMappings[create.sourceKey] = {
      sourceBoardId: create.sourceBoardId,
      sourceItemId: create.sourceItemId,
      rollupItemId,
      hash: create.hash
    };
  }

  for (const update of plan.updates) {
    await api.updateItem({
      boardId: targetBoardId,
      itemId: update.rollupItemId,
      columnValues: update.columnValues
    });
    nextMappings[update.sourceKey] = {
      sourceBoardId: update.sourceBoardId,
      sourceItemId: update.sourceItemId,
      rollupItemId: update.rollupItemId,
      hash: update.hash
    };
  }

  return {
    mappings: nextMappings,
    summary: {
      created: plan.creates.length,
      updated: plan.updates.length,
      skipped: plan.skips.length
    }
  };
}
