pragma foreign_keys = on;

create table if not exists criteria_records (
  id integer primary key autoincrement,
  panel text not null default '',
  topic text not null default '',
  variant text not null default '',
  scenario text not null default '',
  scenario_id text not null default '',
  procedure text not null default '',
  adult_rrl text not null default '',
  peds_rrl text not null default '',
  appropriateness_category text not null default '',
  source_sheet text not null default '',
  source_row integer,
  source_hash text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create index if not exists idx_criteria_panel on criteria_records(panel);
create index if not exists idx_criteria_topic on criteria_records(topic);
create index if not exists idx_criteria_scenario on criteria_records(scenario);
create index if not exists idx_criteria_scenario_id on criteria_records(scenario_id);
create index if not exists idx_criteria_category on criteria_records(appropriateness_category);
create unique index if not exists uq_criteria_record_identity on criteria_records(
  panel,
  topic,
  variant,
  scenario,
  scenario_id,
  procedure,
  adult_rrl,
  peds_rrl,
  appropriateness_category
);

create table if not exists import_runs (
  id integer primary key autoincrement,
  source_name text not null,
  source_path text,
  selected_sheet text,
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  duplicate_count integer not null default 0,
  failed_count integer not null default 0,
  missing_fields text not null default '',
  mapping_json text not null default '{}',
  sheet_summary_json text not null default '[]',
  status text not null default 'running',
  message text not null default '',
  started_at text not null default (datetime('now')),
  finished_at text
);

create table if not exists import_errors (
  id integer primary key autoincrement,
  run_id integer not null references import_runs(id) on delete cascade,
  row_number integer,
  reason text not null,
  raw_json text not null default '{}'
);

create table if not exists app_meta (
  key text primary key,
  value text not null
);

insert or ignore into app_meta(key, value) values('schema_version', '1');
