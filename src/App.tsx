import { useCallback, useEffect, useMemo, useState } from "react";
import type { CriteriaRecord, ScenarioSummary, TreePanel } from "./types";
import { api } from "./lib/api";
import { Toolbar } from "./components/Toolbar";
import { TreeNav } from "./components/TreeNav";
import { ScenarioList } from "./components/ScenarioList";
import { RecordGrid } from "./components/RecordGrid";
import { ImportDialog } from "./components/ImportDialog";

type Selection = { panel?: string; topic?: string };
const BLANK_FILTER = "__blank__";

function toFilterValue(value?: string) {
  if (!value) return "";
  return value.startsWith("(Unassigned") ? BLANK_FILTER : value;
}

function toRecordValue(value?: string) {
  if (!value || value.startsWith("(Unassigned")) return "";
  return value;
}

export function App() {
  const [tree, setTree] = useState<TreePanel[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [records, setRecords] = useState<CriteriaRecord[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedScenario, setSelectedScenario] = useState<ScenarioSummary>();
  const [selectedRecord, setSelectedRecord] = useState<CriteriaRecord>();
  const [dirty, setDirty] = useState<Record<number, Partial<CriteriaRecord>>>({});
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<keyof CriteriaRecord>("scenario");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [importOpen, setImportOpen] = useState(false);

  const paramsBase = useMemo(() => {
    const params = new URLSearchParams();
    if (selection.panel) params.set("panel", toFilterValue(selection.panel));
    if (selection.topic) params.set("topic", toFilterValue(selection.topic));
    if (search) params.set("search", search);
    return params;
  }, [selection, search]);

  const refreshTree = useCallback(async () => {
    const next = await api.tree();
    setTree(next);
    if (!expanded.size && next[0]) {
      setExpanded(new Set([next[0].panel]));
    }
  }, [expanded.size]);

  const refreshScenarios = useCallback(async () => {
    const params = new URLSearchParams(paramsBase);
    const next = await api.scenarios(params);
    setScenarios(next);
    setSelectedScenario((current) => {
      if (current && next.some((item) => item.scenario === current.scenario && item.scenario_id === current.scenario_id)) {
        return current;
      }
      return next[0];
    });
  }, [paramsBase]);

  const refreshRecords = useCallback(async () => {
    const params = new URLSearchParams(paramsBase);
    if (selectedScenario?.scenario) params.set("scenario", selectedScenario.scenario);
    if (selectedScenario?.scenario_id) params.set("scenario_id", selectedScenario.scenario_id);
    if (selectedScenario?.variant) params.set("variant", selectedScenario.variant);
    params.set("sort", sort);
    params.set("order", order);
    params.set("limit", "500");
    const result = await api.records(params);
    setRecords(result.records);
    setTotal(result.total);
    setSelectedRecord((current) => result.records.find((record) => record.id === current?.id) ?? result.records[0]);
  }, [paramsBase, selectedScenario, sort, order]);

  useEffect(() => {
    api.health()
      .then((health) => setStatus(`${health.records} records in SQLite`))
      .catch((error) => setStatus(error.message));
    refreshTree().catch((error) => setStatus(error.message));
  }, [refreshTree]);

  useEffect(() => {
    refreshScenarios().catch((error) => setStatus(error.message));
  }, [refreshScenarios]);

  useEffect(() => {
    refreshRecords().catch((error) => setStatus(error.message));
  }, [refreshRecords]);

  function togglePanel(panel: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(panel)) next.delete(panel);
      else next.add(panel);
      return next;
    });
  }

  function editRecord(id: number, field: keyof CriteriaRecord, value: string) {
    setDirty((current) => ({
      ...current,
      [id]: { ...(current[id] ?? {}), [field]: value }
    }));
  }

  async function saveDirty() {
    const entries = Object.entries(dirty);
    for (const [id, patch] of entries) {
      await api.updateRecord(Number(id), patch);
    }
    setDirty({});
    setStatus(`Saved ${entries.length} changed record(s).`);
    await refreshTree();
    await refreshScenarios();
    await refreshRecords();
  }

  async function addRecord() {
    const seed = {
      panel: toRecordValue(selection.panel),
      topic: toRecordValue(selection.topic),
      variant: selectedScenario?.variant ?? "",
      scenario: selectedScenario?.scenario ?? "",
      scenario_id: selectedScenario?.scenario_id ?? "",
      procedure: "New procedure",
      adult_rrl: "",
      peds_rrl: "",
      appropriateness_category: ""
    };
    const created = await api.createRecord(seed);
    setSelectedRecord(created);
    setStatus("Added a new record.");
    await refreshTree();
    await refreshScenarios();
    await refreshRecords();
  }

  async function duplicateRecord() {
    if (!selectedRecord) return;
    const created = await api.duplicateRecord(selectedRecord.id);
    setSelectedRecord(created);
    setStatus("Duplicated selected record.");
    await refreshTree();
    await refreshScenarios();
    await refreshRecords();
  }

  async function deleteRecord() {
    if (!selectedRecord) return;
    if (!confirm("Delete the selected record from SQLite?")) return;
    await api.deleteRecord(selectedRecord.id);
    setSelectedRecord(undefined);
    setStatus("Deleted selected record.");
    await refreshTree();
    await refreshScenarios();
    await refreshRecords();
  }

  function sortBy(field: keyof CriteriaRecord) {
    if (sort === field) setOrder((current) => (current === "asc" ? "desc" : "asc"));
    else {
      setSort(field);
      setOrder("asc");
    }
  }

  const dirtyCount = Object.keys(dirty).length;

  return (
    <div className="app-shell">
      <Toolbar
        onImport={() => setImportOpen(true)}
        onAdd={addRecord}
        onDuplicate={duplicateRecord}
        onDelete={deleteRecord}
        onSave={saveDirty}
        search={search}
        onSearch={setSearch}
        selectedCount={selectedRecord ? 1 : 0}
      />
      <main className="workspace">
        <TreeNav tree={tree} selection={selection} expanded={expanded} onToggle={togglePanel} onSelect={setSelection} />
        <ScenarioList scenarios={scenarios} selected={selectedScenario} onSelect={setSelectedScenario} />
        <RecordGrid
          records={records}
          selectedId={selectedRecord?.id}
          dirty={dirty}
          onSelect={setSelectedRecord}
          onEdit={editRecord}
          onSort={sortBy}
        />
      </main>
      <footer className="statusbar">
        <span>{status}</span>
        <span>{total} matching procedures</span>
        <span>{dirtyCount} unsaved edits</span>
        <span>Sort: {sort} {order}</span>
      </footer>
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          await refreshTree();
          await refreshScenarios();
          await refreshRecords();
        }}
      />
    </div>
  );
}
