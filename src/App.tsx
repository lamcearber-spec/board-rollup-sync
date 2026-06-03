import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Database, Eye, Play, Save, ShieldAlert } from "lucide-react";
import { createMondayRollupApi, fetchBoard, fetchBoardColumns } from "./monday/client";
import { createMondayRuntime, isEmbeddedInMonday, type MondayRuntime } from "./monday/runtime";
import { fixtureSourceBoards, fixtureTargetColumns } from "./fixtures";
import { parseBoardIds, parseColumnMappings } from "./rollup/config";
import { executeRollupPlan } from "./rollup/executor";
import { planRollupOperations } from "./rollup/planner";
import type { ItemMapping, RollupColumn, RollupConfig, RollupPlan, SourceBoard } from "./rollup/types";
import { loadJson, saveJson } from "./storage";
import "./App.css";

const CONFIG_KEY = "rollup:config:v1";
const MAPPINGS_KEY = "rollup:mappings:v1";

const defaultConfig: RollupConfig = {
  sourceBoardIds: ["100", "101"],
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

type RunStatus = "idle" | "loading" | "ready" | "error";

function configToMappingText(config: RollupConfig): string {
  return config.mirroredColumns.map((mapping) => `${mapping.sourceTitle} = ${mapping.rollupColumnId}`).join("\n");
}

function accountSlugFromContext(context: Record<string, unknown>): string | undefined {
  const account = context.account;
  if (account && typeof account === "object" && "slug" in account && typeof account.slug === "string") {
    return account.slug;
  }

  return undefined;
}

function summary(plan: RollupPlan | null): { creates: number; updates: number; skips: number } {
  return {
    creates: plan?.creates.length ?? 0,
    updates: plan?.updates.length ?? 0,
    skips: plan?.skips.length ?? 0
  };
}

function buildConfig(form: {
  sourceBoardIds: string;
  targetBoardId: string;
  targetGroupId: string;
  sourceBoardColumnId: string;
  sourceItemColumnId: string;
  hashColumnId: string;
  mappingsText: string;
}): RollupConfig {
  return {
    sourceBoardIds: parseBoardIds(form.sourceBoardIds),
    targetBoardId: form.targetBoardId.trim(),
    targetGroupId: form.targetGroupId.trim(),
    sourceBoardColumnId: form.sourceBoardColumnId.trim(),
    sourceItemColumnId: form.sourceItemColumnId.trim(),
    hashColumnId: form.hashColumnId.trim(),
    mirroredColumns: parseColumnMappings(form.mappingsText)
  };
}

function planRows(plan: RollupPlan | null): Array<{ label: string; detail: string; type: "create" | "update" | "skip" }> {
  if (!plan) {
    return [];
  }

  return [
    ...plan.creates.map((create) => ({ label: create.itemName, detail: create.sourceKey, type: "create" as const })),
    ...plan.updates.map((update) => ({ label: update.rollupItemId, detail: update.sourceKey, type: "update" as const })),
    ...plan.skips.map((skip) => ({ label: skip, detail: "Already current", type: "skip" as const }))
  ].slice(0, 12);
}

function App() {
  const embedded = isEmbeddedInMonday();
  const runtimeRef = useRef<MondayRuntime | null>(null);
  const [mappings, setMappings] = useState<Record<string, ItemMapping>>({});
  const [sourceBoardIds, setSourceBoardIds] = useState(defaultConfig.sourceBoardIds.join(", "));
  const [targetBoardId, setTargetBoardId] = useState(defaultConfig.targetBoardId);
  const [targetGroupId, setTargetGroupId] = useState(defaultConfig.targetGroupId);
  const [sourceBoardColumnId, setSourceBoardColumnId] = useState(defaultConfig.sourceBoardColumnId);
  const [sourceItemColumnId, setSourceItemColumnId] = useState(defaultConfig.sourceItemColumnId);
  const [hashColumnId, setHashColumnId] = useState(defaultConfig.hashColumnId);
  const [mappingsText, setMappingsText] = useState(configToMappingText(defaultConfig));
  const [targetColumns, setTargetColumns] = useState<RollupColumn[]>(fixtureTargetColumns);
  const [lastPlan, setLastPlan] = useState<RollupPlan | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState(embedded ? "Connect this view to monday to load config." : "Fixture preview mode");
  const [accountSlug, setAccountSlug] = useState<string | undefined>(embedded ? undefined : "radom-force");

  useEffect(() => {
    if (!embedded) {
      return undefined;
    }

    let cancelled = false;
    const monday = createMondayRuntime();
    runtimeRef.current = monday;

    async function hydrate() {
      try {
        const [{ data: context }, storedConfig, storedMappings] = await Promise.all([
          monday.get("context"),
          loadJson(monday.storage.instance, CONFIG_KEY, defaultConfig),
          loadJson<Record<string, ItemMapping>>(monday.storage.instance, MAPPINGS_KEY, {})
        ]);
        if (cancelled) return;

        setAccountSlug(accountSlugFromContext(context));
        setMappings(storedMappings);
        setSourceBoardIds(storedConfig.sourceBoardIds.join(", "));
        setTargetBoardId(storedConfig.targetBoardId);
        setTargetGroupId(storedConfig.targetGroupId);
        setSourceBoardColumnId(storedConfig.sourceBoardColumnId);
        setSourceItemColumnId(storedConfig.sourceItemColumnId);
        setHashColumnId(storedConfig.hashColumnId);
        setMappingsText(configToMappingText(storedConfig));
        setMessage("Config loaded from monday storage.");
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setMessage(error instanceof Error ? error.message : "Could not load monday context.");
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [embedded]);

  const currentSummary = useMemo(() => summary(lastPlan), [lastPlan]);

  async function loadBoardsAndColumns(config: RollupConfig): Promise<{ sourceBoards: SourceBoard[]; columns: RollupColumn[] }> {
    const runtime = runtimeRef.current;
    if (!embedded || !runtime) {
      return {
        sourceBoards: fixtureSourceBoards.filter((board) => config.sourceBoardIds.includes(board.id)),
        columns: fixtureTargetColumns
      };
    }

    const [columns, sourceBoards] = await Promise.all([
      fetchBoardColumns(runtime.api, config.targetBoardId),
      Promise.all(config.sourceBoardIds.map((boardId) => fetchBoard(runtime.api, boardId, 100)))
    ]);

    return { sourceBoards, columns };
  }

  async function createPlan(): Promise<{ config: RollupConfig; plan: RollupPlan }> {
    const config = buildConfig({
      sourceBoardIds,
      targetBoardId,
      targetGroupId,
      sourceBoardColumnId,
      sourceItemColumnId,
      hashColumnId,
      mappingsText
    });
    const { sourceBoards, columns } = await loadBoardsAndColumns(config);
    const plan = planRollupOperations({ sourceBoards, config, targetColumns: columns, mappings, accountSlug });
    setTargetColumns(columns);
    setLastPlan(plan);
    setMessage(`Previewed ${sourceBoards.length} source boards into target board ${config.targetBoardId}.`);
    return { config, plan };
  }

  async function handlePreview() {
    try {
      setStatus("loading");
      await createPlan();
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not preview sync.");
    }
  }

  async function handleSave() {
    try {
      const config = buildConfig({
        sourceBoardIds,
        targetBoardId,
        targetGroupId,
        sourceBoardColumnId,
        sourceItemColumnId,
        hashColumnId,
        mappingsText
      });
      const runtime = runtimeRef.current;
      if (embedded && runtime) {
        await saveJson(runtime.storage.instance, CONFIG_KEY, config);
      }
      setStatus("ready");
      setMessage(embedded ? "Config saved to monday storage." : "Fixture config is valid.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Config could not be saved.");
    }
  }

  async function handleRun() {
    try {
      setStatus("loading");
      const { config, plan } = await createPlan();

      const runtime = runtimeRef.current;
      if (!embedded || !runtime) {
        const simulated = { ...mappings };
        for (const create of plan.creates) {
          simulated[create.sourceKey] = {
            sourceBoardId: create.sourceBoardId,
            sourceItemId: create.sourceItemId,
            rollupItemId: `fixture-${create.sourceKey}`,
            hash: create.hash
          };
        }
        for (const update of plan.updates) {
          simulated[update.sourceKey] = {
            sourceBoardId: update.sourceBoardId,
            sourceItemId: update.sourceItemId,
            rollupItemId: update.rollupItemId,
            hash: update.hash
          };
        }
        setMappings(simulated);
        setStatus("ready");
        setMessage("Fixture run simulated. In monday, this writes to the rollup board.");
        return;
      }

      const result = await executeRollupPlan({
        plan,
        targetBoardId: config.targetBoardId,
        targetGroupId: config.targetGroupId,
        mappings,
        api: createMondayRollupApi(runtime.api)
      });
      setMappings(result.mappings);
      await saveJson(runtime.storage.instance, MAPPINGS_KEY, result.mappings);
      setStatus("ready");
      setMessage(`Sync complete: ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.skipped} skipped.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Sync failed.");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow"><ArrowRightLeft size={16} aria-hidden="true" /> monday utility</p>
          <h1>Board Rollup Sync</h1>
        </div>
        <div className={`status-pill status-pill--${status}`}>
          {status === "error" ? <ShieldAlert size={16} aria-hidden="true" /> : <Database size={16} aria-hidden="true" />}
          <span>{message}</span>
        </div>
      </header>

      <section className="workspace-grid" aria-label="Rollup sync workspace">
        <section className="panel config-panel" aria-labelledby="config-title">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Manual v1</p>
              <h2 id="config-title">Sync setup</h2>
            </div>
            <strong>{embedded ? "monday" : "fixture"}</strong>
          </div>

          <label>
            Source board IDs
            <textarea value={sourceBoardIds} onChange={(event) => setSourceBoardIds(event.target.value)} rows={2} />
          </label>

          <div className="field-grid">
            <label>
              Rollup board ID
              <input value={targetBoardId} onChange={(event) => setTargetBoardId(event.target.value)} />
            </label>
            <label>
              Target group ID
              <input value={targetGroupId} onChange={(event) => setTargetGroupId(event.target.value)} />
            </label>
          </div>

          <div className="field-grid">
            <label>
              Source board column
              <input value={sourceBoardColumnId} onChange={(event) => setSourceBoardColumnId(event.target.value)} />
            </label>
            <label>
              Source item link column
              <input value={sourceItemColumnId} onChange={(event) => setSourceItemColumnId(event.target.value)} />
            </label>
          </div>

          <label>
            Sync hash column
            <input value={hashColumnId} onChange={(event) => setHashColumnId(event.target.value)} />
          </label>

          <label>
            Mirrored columns
            <textarea value={mappingsText} onChange={(event) => setMappingsText(event.target.value)} rows={5} />
          </label>

          <div className="button-row">
            <button type="button" onClick={handleSave}><Save size={16} aria-hidden="true" /> Save config</button>
            <button type="button" onClick={handlePreview}><Eye size={16} aria-hidden="true" /> Preview sync</button>
            <button type="button" className="primary-button" onClick={handleRun}><Play size={16} aria-hidden="true" /> Run manual sync</button>
          </div>
        </section>

        <section className="panel results-panel" aria-labelledby="results-title">
          <div className="panel-heading">
            <div>
              <p className="panel-kicker">Dry-run plan</p>
              <h2 id="results-title">Rollup result</h2>
            </div>
            <CheckCircle2 size={22} aria-hidden="true" />
          </div>

          <div className="summary-grid" aria-label="Plan summary">
            <strong>{currentSummary.creates} creates</strong>
            <strong>{currentSummary.updates} updates</strong>
            <strong>{currentSummary.skips} skipped</strong>
          </div>

          <div className="result-list" aria-label="Planned operations">
            {planRows(lastPlan).length === 0 ? (
              <p className="empty-state">Preview a sync to see which rollup items will be created, updated, or skipped.</p>
            ) : (
              planRows(lastPlan).map((row) => (
                <article className={`result-row result-row--${row.type}`} key={`${row.type}-${row.label}-${row.detail}`}>
                  <span>{row.type}</span>
                  <div>
                    <strong>{row.label}</strong>
                    <p>{row.detail}</p>
                  </div>
                </article>
              ))
            )}
          </div>

          <div className="columns-panel">
            <p className="panel-kicker">Target column IDs</p>
            <div className="column-chips">
              {targetColumns.map((column) => (
                <code key={column.id}>{column.id} <span>{column.type}</span></code>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
