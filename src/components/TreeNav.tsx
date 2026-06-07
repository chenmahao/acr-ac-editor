import { ChevronDown, ChevronRight, PanelLeft } from "lucide-react";
import type { TreePanel } from "../types";

type Selection = { panel?: string; topic?: string };

export function TreeNav({
  tree,
  selection,
  expanded,
  onToggle,
  onSelect
}: {
  tree: TreePanel[];
  selection: Selection;
  expanded: Set<string>;
  onToggle: (panel: string) => void;
  onSelect: (selection: Selection) => void;
}) {
  return (
    <aside className="tree-pane">
      <div className="pane-title">
        <PanelLeft size={16} />
        Panel / Topic
      </div>
      <button className="tree-reset" onClick={() => onSelect({})}>
        All records
      </button>
      <div className="tree-list">
        {tree.map((panel) => {
          const isOpen = expanded.has(panel.panel);
          const selected = selection.panel === panel.panel && !selection.topic;
          return (
            <div key={panel.panel} className="tree-group">
              <button
                className={`tree-row panel-row ${selected ? "selected" : ""}`}
                onClick={() => onSelect({ panel: panel.panel })}
              >
                <span onClick={(event) => { event.stopPropagation(); onToggle(panel.panel); }}>
                  {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </span>
                <span className="tree-label">{panel.panel}</span>
                <span className="tree-count">{panel.procedures}</span>
              </button>
              {isOpen && (
                <div className="topic-list">
                  {panel.topics.map((topic) => (
                    <button
                      key={`${panel.panel}:${topic.topic}`}
                      className={`tree-row topic-row ${
                        selection.panel === panel.panel && selection.topic === topic.topic ? "selected" : ""
                      }`}
                      onClick={() => onSelect({ panel: panel.panel, topic: topic.topic })}
                    >
                      <span className="tree-label">{topic.topic}</span>
                      <span className="tree-count">{topic.procedures}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
