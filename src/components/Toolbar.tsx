import { Copy, Database, Download, FilePlus, FolderOpen, Plus, Save, Search, Trash2 } from "lucide-react";

type ToolbarProps = {
  onImport: () => void;
  onAdd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSave: () => void;
  search: string;
  onSearch: (value: string) => void;
  selectedCount: number;
};

export function Toolbar({
  onImport,
  onAdd,
  onDuplicate,
  onDelete,
  onSave,
  search,
  onSearch,
  selectedCount
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="brand">
        <Database size={18} />
        <div>
          <strong>ACR AC Editor</strong>
          <span>Local SQLite registry</span>
        </div>
      </div>
      <button onClick={onImport} title="Import Excel">
        <FolderOpen size={16} /> Import Excel
      </button>
      <button onClick={onSave} title="Save selected edits" disabled={!selectedCount}>
        <Save size={16} /> Save
      </button>
      <button onClick={onAdd} title="Add record">
        <Plus size={16} /> Add
      </button>
      <button onClick={onDuplicate} title="Duplicate selected" disabled={!selectedCount}>
        <Copy size={16} /> Duplicate
      </button>
      <button onClick={onDelete} title="Delete selected" disabled={!selectedCount} className="danger">
        <Trash2 size={16} /> Delete
      </button>
      <a className="button" href="/api/export/csv" title="Export CSV">
        <Download size={16} /> CSV
      </a>
      <a className="button" href="/api/export/xlsx" title="Export Excel">
        <FilePlus size={16} /> Excel
      </a>
      <a className="button" href="/api/export/json" title="Export JSON">
        <Download size={16} /> JSON
      </a>
      <label className="global-search">
        <Search size={16} />
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search all fields" />
      </label>
    </header>
  );
}
