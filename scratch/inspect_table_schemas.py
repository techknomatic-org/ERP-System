import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd() / 'backend'))
from app.database import engine
import sqlalchemy as sa

insp = sa.inspect(engine)
tables = [
    'technical_sanctions', 'contractor_awards', 'work_orders',
    'work_plans', 'work_plan_boq_mappings', 'project_team_members',
    'task_assignments', 'project_milestones', 'site_daily_logs',
    'measurement_books', 'hindrance_records'
]

for tbl in tables:
    if not insp.has_table(tbl):
        print(f"MISSING TABLE: {tbl}")
        continue
    cols = insp.get_columns(tbl)
    col_names = [c['name'] + ('*' if not c.get('nullable', True) else '') for c in cols]
    print(f"\nTable {tbl:25s} ({len(cols)} cols):")
    print("  " + ", ".join(col_names))
