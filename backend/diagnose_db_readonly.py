import os
import sys
import pymysql

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.config import settings

def run_diagnostic():
    db_cfg = settings.parsed_db_config
    
    print("=== 1. CURRENT APPLICATION CONFIG ===")
    print(f"DB_HOST: {db_cfg['host']}")
    print(f"DB_PORT: {db_cfg['port']}")
    print(f"DB_NAME: {db_cfg['database']}")
    print(f"DB_USER: {db_cfg['user']}")
    
    conn = pymysql.connect(
        host=db_cfg["host"],
        port=int(db_cfg["port"]),
        user=db_cfg["user"],
        password=db_cfg["password"]
    )
    
    cursor = conn.cursor()
    
    # List all databases
    print("\n=== 2. ALL AVAILABLE DATABASES IN MYSQL ===")
    cursor.execute("SHOW DATABASES;")
    databases = [row[0] for row in cursor.fetchall()]
    for db_name in databases:
        print(f" - {db_name}")
        
    # Check databases for ERP tables
    likely_dbs = [d for d in databases if d not in ['information_schema', 'mysql', 'performance_schema', 'sys']]
    
    for db_name in likely_dbs:
        print(f"\n=== 3. INSPECTING DATABASE: {db_name} ===")
        cursor.execute(f"USE `{db_name}`;")
        cursor.execute("SHOW TABLES;")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Total tables: {len(tables)}")
        
        # Check row counts of key tables
        key_tables = [
            "users", "tenant_settings", "projects", "boq_items", "wbs_tasks",
            "work_plans", "project_estimates", "detailed_estimate_items",
            "schedule_of_rates", "technical_sanctions", "work_plan_boq_mappings",
            "site_daily_logs", "daily_task_monitoring", "audit_logs"
        ]
        
        for kt in key_tables:
            if kt in tables:
                cursor.execute(f"SELECT COUNT(*) FROM `{kt}`;")
                count = cursor.fetchone()[0]
                print(f"  {kt}: {count} rows")
            else:
                print(f"  {kt}: [TABLE NOT FOUND]")
                
        # If projects table exists, list projects
        if "projects" in tables:
            cursor.execute("SELECT id, name, code, status, created_at FROM projects;")
            proj_rows = cursor.fetchall()
            print(f"  --> Projects in {db_name} ({len(proj_rows)} total):")
            for p in proj_rows:
                print(f"      ID={p[0]}, Code={p[2]}, Name='{p[1]}', Status={p[3]}, Created={p[4]}")
                
        # Check for WPT-02 records specifically
        if "projects" in tables:
            cursor.execute("SELECT id, name, code FROM projects WHERE name LIKE '%WPT%' OR code LIKE '%WPT%';")
            wpt_projs = cursor.fetchall()
            print(f"  --> WPT Projects: {wpt_projs}")
            
        if "wbs_tasks" in tables:
            cursor.execute("SELECT COUNT(*) FROM wbs_tasks WHERE title LIKE '%WPT%' OR wbs_code LIKE '%WPT%' OR title IN ('Foundation', 'Ground Floor', 'First Floor', 'Phase 1', 'Task 1');")
            wpt_tasks_count = cursor.fetchone()[0]
            print(f"  --> Relevant WBS tasks count: {wpt_tasks_count}")
            
        if "work_plans" in tables:
            cursor.execute("SELECT COUNT(*) FROM work_plans WHERE work_plan_number LIKE '%WP-%';")
            wp_count = cursor.fetchone()[0]
            print(f"  --> Work plans with WP- number: {wp_count}")
            
        if "work_plan_boq_mappings" in tables:
            cursor.execute("SELECT COUNT(*) FROM work_plan_boq_mappings;")
            mapping_count = cursor.fetchone()[0]
            print(f"  --> Total Work Plan BOQ mappings: {mapping_count}")

    cursor.close()
    conn.close()

if __name__ == "__main__":
    run_diagnostic()
