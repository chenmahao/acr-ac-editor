export type CriteriaRecord = {
  id: number;
  panel: string;
  topic: string;
  variant: string;
  scenario: string;
  scenario_id: string;
  procedure: string;
  adult_rrl: string;
  peds_rrl: string;
  appropriateness_category: string;
  source_sheet?: string;
  source_row?: number;
  created_at?: string;
  updated_at?: string;
};

export type TreePanel = {
  panel: string;
  scenarios: number;
  procedures: number;
  topics: Array<{ topic: string; scenarios: number; procedures: number }>;
};

export type ScenarioSummary = {
  panel: string;
  topic: string;
  variant: string;
  scenario: string;
  scenario_id: string;
  procedure_count: number;
  categories: string;
};

export type SheetPreview = {
  name: string;
  rowCount: number;
  headers: string[];
  sampleRows: Record<string, unknown>[];
  suggestedMapping: Record<string, string>;
  score: number;
};

export type ImportRun = {
  id: number;
  source_name: string;
  selected_sheet: string;
  total_rows: number;
  inserted_count: number;
  duplicate_count: number;
  failed_count: number;
  missing_fields: string;
  status: string;
  message: string;
  started_at: string;
  finished_at: string;
};
