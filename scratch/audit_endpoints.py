import sys
from pathlib import Path
import re

api_dir = Path("backend/app/api")
endpoints_to_check = [
    "projects.py", "boq_mb.py", "estimation.py", "technical_sanctions.py",
    "contractor_awards.py", "work_orders.py", "wbs.py", "work_plans.py",
    "project_teams.py", "task_assignments.py", "milestones.py", "site_logs.py",
    "hindrances.py", "contractor_billing.py", "dashboard.py", "ai_analytics.py"
]

print("=== Auditing Backend API Project Filtering ===")
for fname in endpoints_to_check:
    fpath = api_dir / fname
    if not fpath.exists():
        print(f"File not found: {fname}")
        continue
    content = fpath.read_text(encoding="utf-8")
    get_routes = re.findall(r'@router\.get\((.*?)\)\s*\ndef\s+([a-zA-Z0-9_]+)\((.*?)\)', content, re.DOTALL)
    print(f"\n--- {fname} ({len(get_routes)} GET routes) ---")
    for path, func_name, params in get_routes:
        path_clean = path.split(",")[0].strip().strip('"').strip("'")
        has_proj = "project_id" in path or "project_id" in params
        print(f"  {path_clean:40s} | func: {func_name:25s} | has project_id: {has_proj}")
