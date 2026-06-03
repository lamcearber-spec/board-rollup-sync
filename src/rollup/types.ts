export type SourceColumn = {
  id: string;
  title: string;
  type: string;
};

export type SourceValue = {
  id: string;
  text: string;
  value: unknown;
  type: string;
};

export type SourceItem = {
  id: string;
  name: string;
  values: Record<string, SourceValue>;
};

export type SourceBoard = {
  id: string;
  name: string;
  columns: SourceColumn[];
  items: SourceItem[];
};

export type RollupColumn = {
  id: string;
  title: string;
  type: string;
};

export type ColumnMapping = {
  sourceTitle: string;
  rollupColumnId: string;
};

export type RollupConfig = {
  sourceBoardIds: string[];
  targetBoardId: string;
  targetGroupId: string;
  sourceBoardColumnId: string;
  sourceItemColumnId: string;
  hashColumnId: string;
  mirroredColumns: ColumnMapping[];
};

export type ItemMapping = {
  sourceBoardId: string;
  sourceItemId: string;
  rollupItemId: string;
  hash: string;
};

export type CreateOperation = {
  sourceBoardId: string;
  sourceItemId: string;
  sourceKey: string;
  itemName: string;
  columnValues: Record<string, unknown>;
  hash: string;
};

export type UpdateOperation = {
  rollupItemId: string;
  sourceBoardId: string;
  sourceItemId: string;
  sourceKey: string;
  columnValues: Record<string, unknown>;
  hash: string;
};

export type RollupPlan = {
  creates: CreateOperation[];
  updates: UpdateOperation[];
  skips: string[];
};
