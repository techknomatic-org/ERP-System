import os
import pymysql
from sqlalchemy import text, inspect
from app.config import settings
from app.database import engine, Base, SessionLocal
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def auto_init_db():
    """
    Automatic Database Initializer & Schema Migrator.
    Runs on FastAPI startup to:
    1. Ensure target database exists (using deployment-aware credentials).
    2. Create all tables defined in SQLAlchemy models.
    3. Run column auto-migrations & schema fixes across all tables.
    4. Seed default user credentials if database is empty.
    """
    print("[DB Auto-Init] Checking database connection and schema...")
    db_cfg = settings.parsed_db_config
    
    # 1. Create DB if not exists (MySQL)
    try:
        connection = pymysql.connect(
            host=db_cfg["host"],
            port=int(db_cfg["port"]),
            user=db_cfg["user"],
            password=db_cfg["password"]
        )
        with connection.cursor() as cursor:
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_cfg['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        connection.close()
        print(f"[DB Auto-Init] Database '{db_cfg['database']}' verified/created successfully.")
    except Exception as e:
        print(f"[DB Auto-Init] Note on DB creation: {e}")

    # 2. Create All SQLAlchemy Tables
    try:
        # Import all models to ensure metadata registration
        import app.models  # noqa
        Base.metadata.create_all(bind=engine)
        print("[DB Auto-Init] All SQLAlchemy tables verified/created successfully.")
    except Exception as e:
        print(f"[DB Auto-Init] Error creating tables: {e}")
        return

    # 3. Dynamic & Explicit Column Auto-Migrations
    try:
        connection = pymysql.connect(
            host=db_cfg["host"],
            port=int(db_cfg["port"]),
            user=db_cfg["user"],
            password=db_cfg["password"],
            database=db_cfg["database"]
        )
        with connection.cursor() as cursor:
            db_name = db_cfg["database"]

            def add_col_if_missing(table_name: str, column_name: str, column_def: str):
                cursor.execute(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s;",
                    (db_name, table_name, column_name)
                )
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE `{table_name}` ADD COLUMN `{column_name}` {column_def};")
                    print(f"[DB Auto-Init] Added column '{column_name}' to table '{table_name}'.")

            # site_daily_logs columns
            for col, col_type in [("phase_id", "INT NULL"), ("task_id", "INT NULL"), ("subtask_id", "INT NULL")]:
                add_col_if_missing("site_daily_logs", col, col_type)

            # measurement_books
            add_col_if_missing("measurement_books", "site_log_id", "INT NULL")

            # wbs_tasks
            add_col_if_missing("wbs_tasks", "wbs_code", "VARCHAR(50) NULL")

            # boq_items
            add_col_if_missing("boq_items", "sor_id", "INT NULL")

            # projects
            proj_cols = [
                ("tenant_name", "VARCHAR(100) NOT NULL DEFAULT 'Default Tenant'"),
                ("division_id", "INT NULL"),
                ("division_name", "VARCHAR(100) NULL"),
                ("contract_type", "VARCHAR(50) NOT NULL DEFAULT 'Item Rate'"),
                ("funding_mode", "VARCHAR(50) NOT NULL DEFAULT 'Budgeted'"),
                ("latitude", "DECIMAL(10, 8) NULL"),
                ("longitude", "DECIMAL(11, 8) NULL"),
                ("contract_duration_days", "INT NOT NULL DEFAULT 0"),
                ("sor_edition_id", "INT NULL"),
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_id", "INT NULL"),
                ("sor_region_name", "VARCHAR(100) NULL")
            ]
            for col, col_type in proj_cols:
                add_col_if_missing("projects", col, col_type)

            # schedule_of_rates
            sor_cols = [
                ("sor_edition_id", "INT NULL"),
                ("sor_region_id", "INT NULL"),
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_name", "VARCHAR(100) NULL"),
                ("base_rate", "DECIMAL(12, 2) NULL"),
                ("cost_index", "DECIMAL(8, 4) NULL DEFAULT 1.0000")
            ]
            for col, col_type in sor_cols:
                add_col_if_missing("schedule_of_rates", col, col_type)

            # contractor_bills
            cb_cols = [
                ("sor_edition_name", "VARCHAR(100) NULL"),
                ("sor_region_name", "VARCHAR(100) NULL"),
                ("sor_code", "VARCHAR(50) NULL"),
                ("base_rate", "DECIMAL(12, 2) NULL"),
                ("cost_index", "DECIMAL(8, 4) NULL"),
                ("adjusted_rate", "DECIMAL(12, 2) NULL"),
                ("snapshot_timestamp", "DATETIME NULL")
            ]
            for col, col_type in cb_cols:
                add_col_if_missing("contractor_bills", col, col_type)

            # project_estimates
            pe_cols = [
                ("base_amount", "DECIMAL(14, 2) DEFAULT 0.00"),
                ("contingency_percent", "DECIMAL(5, 2) DEFAULT 5.00"),
                ("contingency_amount", "DECIMAL(14, 2) DEFAULT 0.00"),
                ("departmental_charges_percent", "DECIMAL(5, 2) DEFAULT 2.00"),
                ("departmental_charges_amount", "DECIMAL(14, 2) DEFAULT 0.00"),
                ("is_ee_review_required", "TINYINT(1) DEFAULT 0"),
                ("ee_review_reason", "TEXT NULL"),
                ("ts_status", "VARCHAR(30) DEFAULT 'PENDING'"),
                ("is_ts_locked", "TINYINT(1) DEFAULT 0"),
                ("revision_number", "INT DEFAULT 0"),
                ("original_estimate_id", "INT NULL"),
                ("is_revised", "TINYINT(1) DEFAULT 0")
            ]
            for col, col_type in pe_cols:
                add_col_if_missing("project_estimates", col, col_type)

            # project_estimate_lines
            pel_cols = [
                ("rate_source", "VARCHAR(30) DEFAULT 'SOR'"),
                ("manual_rate", "DECIMAL(12, 2) NULL"),
                ("is_manual_override", "TINYINT(1) DEFAULT 0"),
                ("justification_note", "TEXT NULL")
            ]
            for col, col_type in pel_cols:
                add_col_if_missing("project_estimate_lines", col, col_type)

            # Fix quantity column precision for project_estimate_lines if table exists
            cursor.execute(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'project_estimate_lines' AND COLUMN_NAME = 'quantity';",
                (db_name,)
            )
            if cursor.fetchone()[0] > 0:
                cursor.execute("ALTER TABLE `project_estimate_lines` MODIFY COLUMN `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 0.000;")

            # material_purchase_requests
            mpr_cols = [
                ("wbs_phase_id", "INT NULL"),
                ("wbs_task_id", "INT NULL"),
                ("subtask_id", "INT NULL"),
                ("wbs_subtask_id", "INT NULL"),
                ("estimated_unit_rate", "DECIMAL(12, 2) NULL")
            ]
            for col, col_type in mpr_cols:
                add_col_if_missing("material_purchase_requests", col, col_type)

            # purchase_requisitions
            pr_cols = [
                ("wbs_phase_id", "INT NULL"),
                ("wbs_task_id", "INT NULL"),
                ("wbs_subtask_id", "INT NULL")
            ]
            for col, col_type in pr_cols:
                add_col_if_missing("purchase_requisitions", col, col_type)

            # purchase_orders
            po_cols = [
                ("mpr_id", "INT NULL"),
                ("wbs_phase_id", "INT NULL"),
                ("wbs_task_id", "INT NULL"),
                ("wbs_subtask_id", "INT NULL"),
                ("unit", "VARCHAR(50) DEFAULT 'unit'"),
                ("po_date", "DATETIME NULL"),
                ("expected_delivery_date", "DATETIME NULL"),
                ("payment_terms", "VARCHAR(255) NULL"),
                ("delivery_terms", "VARCHAR(255) NULL"),
                ("remarks", "TEXT NULL"),
                ("created_by_id", "INT NULL")
            ]
            for col, col_type in po_cols:
                add_col_if_missing("purchase_orders", col, col_type)

            # Also check all SQLAlchemy models using Inspector for missing columns
            try:
                inspector = inspect(engine)
                existing_tables = set(inspector.get_table_names())
                for table_name, table_obj in Base.metadata.tables.items():
                    if table_name in existing_tables:
                        existing_cols = {col["name"] for col in inspector.get_columns(table_name)}
                        for column in table_obj.columns:
                            if column.name not in existing_cols:
                                add_col_if_missing(table_name, column.name, f"{column.type} NULL")
            except Exception as insp_err:
                print(f"[DB Auto-Init] Inspector column scan note: {insp_err}")

        connection.commit()
        connection.close()
        print("[DB Auto-Init] Column auto-migrations completed successfully.")
    except Exception as e:
        print(f"[DB Auto-Init] Column migration note: {e}")

    # 4. Seed Default User Credentials if Users table is empty
    try:
        from app.models import User
        db = SessionLocal()
        user_count = db.query(User).count()
        if user_count == 0:
            print("[DB Auto-Init] Empty database detected — seeding default user accounts...")
            demo_users_seed = [
                ("admin", "admin@erp.local", "System Administrator", "admin", "admin123"),
                ("pm", "pm@erp.local", "Project Manager", "project_manager", "pm123"),
                ("site", "site@erp.local", "Site Engineer", "site_engineer", "site123"),
                ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
                ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
                ("customer", "customer@abccorp.com", "ABC Customer Account", "customer", "customer123"),
            ]
            for uname, uemail, ufull, urole, upass in demo_users_seed:
                u_obj = User(
                    username=uname,
                    email=uemail,
                    full_name=ufull,
                    hashed_password=pwd_context.hash(upass),
                    role=urole,
                    is_active=True
                )
                db.add(u_obj)
            db.commit()
            print("[DB Auto-Init] Default user accounts seeded successfully!")
        db.close()
    except Exception as e:
        print(f"[DB Auto-Init] User seed note: {e}")

if __name__ == "__main__":
    auto_init_db()
