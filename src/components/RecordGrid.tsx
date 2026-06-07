import type { CriteriaRecord } from "../types";

const COLUMNS: Array<{ field: keyof CriteriaRecord; label: string; width?: number }> = [
  { field: "panel", label: "Panel", width: 140 },
  { field: "topic", label: "Topic", width: 160 },
  { field: "variant", label: "Variants", width: 180 },
  { field: "scenario", label: "Scenario", width: 320 },
  { field: "scenario_id", label: "Scenario ID", width: 120 },
  { field: "procedure", label: "Procedure", width: 260 },
  { field: "adult_rrl", label: "Adult RRL", width: 130 },
  { field: "peds_rrl", label: "Peds RRL", width: 130 },
  { field: "appropriateness_category", label: "Appropriateness Category", width: 220 }
];

export function RecordGrid({
  records,
  selectedId,
  dirty,
  onSelect,
  onEdit,
  onSort
}: {
  records: CriteriaRecord[];
  selectedId?: number;
  dirty: Record<number, Partial<CriteriaRecord>>;
  onSelect: (record: CriteriaRecord) => void;
  onEdit: (id: number, field: keyof CriteriaRecord, value: string) => void;
  onSort: (field: keyof CriteriaRecord) => void;
}) {
  return (
    <section className="record-pane">
      <div className="pane-title">Procedure Details</div>
      <div className="grid-wrap">
        <table className="record-grid">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th key={column.field} style={{ minWidth: column.width }} onClick={() => onSort(column.field)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const patch = dirty[record.id] ?? {};
              return (
                <tr
                  key={record.id}
                  className={`${record.id === selectedId ? "selected" : ""} ${dirty[record.id] ? "dirty" : ""}`}
                  onClick={() => onSelect(record)}
                >
                  {COLUMNS.map((column) => (
                    <td key={column.field}>
                      <input
                        value={String((patch[column.field] ?? record[column.field]) ?? "")}
                        onChange={(event) => onEdit(record.id, column.field, event.target.value)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
