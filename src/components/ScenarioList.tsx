import type { ScenarioSummary } from "../types";

export function ScenarioList({
  scenarios,
  selected,
  onSelect
}: {
  scenarios: ScenarioSummary[];
  selected?: ScenarioSummary;
  onSelect: (scenario: ScenarioSummary) => void;
}) {
  return (
    <section className="scenario-pane">
      <div className="pane-title">Variants / Scenario</div>
      <div className="scenario-list">
        {scenarios.map((scenario) => {
          const active =
            selected?.scenario === scenario.scenario &&
            selected?.scenario_id === scenario.scenario_id &&
            selected?.variant === scenario.variant;
          return (
            <button
              key={`${scenario.panel}:${scenario.topic}:${scenario.variant}:${scenario.scenario}:${scenario.scenario_id}`}
              className={`scenario-card ${active ? "selected" : ""}`}
              onClick={() => onSelect(scenario)}
            >
              <div className="scenario-main">{scenario.scenario || "(No scenario text)"}</div>
              <div className="scenario-meta">
                <span>{scenario.variant || "No variant"}</span>
                <span>ID {scenario.scenario_id || "-"}</span>
                <span>{scenario.procedure_count} procedures</span>
              </div>
              <div className="scenario-cats">{scenario.categories}</div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
