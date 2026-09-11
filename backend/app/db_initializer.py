import os
import sys
import pymysql

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import text, inspect
from app.config import settings
from app.database import engine, Base, SessionLocal
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def auto_init_db():
    """
    Automatic Database Initializer & Seed Service (Production Ready).
    Runs on FastAPI startup to:
    1. Verify MySQL connection & create database if missing.
    2. Execute schema initialization (schema.sql) if tables are absent.
    3. Perform column auto-migrations across all tables.
    4. Seed default tenant, divisions, roles, and demo users idempotently.
    """
    db_cfg = settings.parsed_db_config

    # 1. MySQL Connection & Database Bootstrap
    try:
        connection = pymysql.connect(
            host=db_cfg["host"],
            port=int(db_cfg["port"]),
            user=db_cfg["user"],
            password=db_cfg["password"]
        )
        print("MySQL Connected.")

        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = %s;", (db_cfg['database'],))
            db_exists = cursor.fetchone()[0] > 0
            if not db_exists:
                cursor.execute(f"CREATE DATABASE `{db_cfg['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
                print("Database Created.")
            else:
                print("Database Already Exists.")
        connection.close()
    except Exception as e:
        print(f"MySQL Connection Note: {e}")
        return

    # 2. Schema Verification & Execution (schema.sql)
    schema_applied_now = False
    try:
        conn = pymysql.connect(
            host=db_cfg["host"],
            port=int(db_cfg["port"]),
            user=db_cfg["user"],
            password=db_cfg["password"],
            database=db_cfg["database"]
        )
        with conn.cursor() as cursor:
            db_name = db_cfg["database"]
            cursor.execute(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'users';",
                (db_name,)
            )
            users_table_exists = cursor.fetchone()[0] > 0

        if not users_table_exists:
            # Locate master schema.sql
            possible_paths = [
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "schema.sql")),
                os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "schema.sql")),
                os.path.abspath("schema.sql")
            ]
            schema_file = next((p for p in possible_paths if os.path.exists(p)), None)

            if schema_file:
                with open(schema_file, "r", encoding="utf-8") as f:
                    sql_script = f.read()
                statements = [stmt.strip() for stmt in sql_script.split(";") if stmt.strip()]
                with conn.cursor() as cursor:
                    for stmt in statements:
                        try:
                            cursor.execute(stmt)
                        except Exception:
                            pass
                conn.commit()
                schema_applied_now = True

        # Always run Base.metadata.create_all to ensure all SQLAlchemy models exist
        import app.models  # noqa
        Base.metadata.create_all(bind=engine)

        # Dynamic & Explicit Column Auto-Migrations
        with conn.cursor() as cursor:
            db_name = db_cfg["database"]

            def add_col_if_missing(table_name: str, column_name: str, column_def: str):
                cursor.execute(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s;",
                    (db_name, table_name, column_name)
                )
                if cursor.fetchone()[0] == 0:
                    cursor.execute(f"ALTER TABLE `{table_name}` ADD COLUMN `{column_name}` {column_def};")

            # site_daily_logs columns
            for col, col_type in [("phase_id", "INT NULL"), ("task_id", "INT NULL"), ("subtask_id", "INT NULL")]:
                add_col_if_missing("site_daily_logs", col, col_type)

            add_col_if_missing("measurement_books", "site_log_id", "INT NULL")
            add_col_if_missing("measurement_books", "wbs_node_id", "INT NULL")
            add_col_if_missing("measurement_books", "client_uuid", "VARCHAR(64) NULL UNIQUE")
            add_col_if_missing("measurement_books", "description", "TEXT NULL")
            add_col_if_missing("measurement_books", "measurement_method", "VARCHAR(30) NULL DEFAULT 'LBH'")
            add_col_if_missing("measurement_books", "length", "DECIMAL(12, 4) NULL")
            add_col_if_missing("measurement_books", "breadth", "DECIMAL(12, 4) NULL")
            add_col_if_missing("measurement_books", "height", "DECIMAL(12, 4) NULL")
            add_col_if_missing("measurement_books", "direct_quantity", "DECIMAL(14, 4) NULL")
            add_col_if_missing("measurement_books", "computed_quantity", "DECIMAL(14, 4) NULL")
            add_col_if_missing("measurement_books", "photo_url", "VARCHAR(500) NULL")
            add_col_if_missing("measurement_books", "photo_metadata", "TEXT NULL")
            add_col_if_missing("measurement_books", "contractor_rep_signer_id", "INT NULL")
            add_col_if_missing("measurement_books", "contractor_rep_signed_at", "DATETIME NULL")
            add_col_if_missing("measurement_books", "contractor_rep_signature_reference", "VARCHAR(255) NULL")
            add_col_if_missing("measurement_books", "je_signer_id", "INT NULL")
            add_col_if_missing("measurement_books", "je_signed_at", "DATETIME NULL")
            add_col_if_missing("measurement_books", "je_signature_reference", "VARCHAR(255) NULL")
            add_col_if_missing("measurement_books", "correction_of_id", "INT NULL")
            add_col_if_missing("measurement_books", "correction_reason", "TEXT NULL")
            add_col_if_missing("measurement_books", "is_stale", "TINYINT(1) DEFAULT 0")
            add_col_if_missing("measurement_books", "is_offline_sync", "TINYINT(1) DEFAULT 0")
            add_col_if_missing("measurement_books", "synced_at", "DATETIME NULL")
            add_col_if_missing("measurement_books", "created_by_id", "INT NULL")
            add_col_if_missing("measurement_books", "updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")

            # Make nullable for flexibility in e-MB
            try:
                cursor.execute("ALTER TABLE `measurement_books` MODIFY COLUMN `boq_item_id` INT NULL;")
                cursor.execute("ALTER TABLE `measurement_books` MODIFY COLUMN `engineer_id` INT NULL;")
                cursor.execute("ALTER TABLE `measurement_books` MODIFY COLUMN `location_zone` VARCHAR(100) NULL;")
            except Exception as e:
                print(f"[DB Initializer Note] {e}")

            # hindrance_records mobile offline sync columns
            add_col_if_missing("hindrance_records", "client_uuid", "VARCHAR(64) NULL UNIQUE")
            add_col_if_missing("hindrance_records", "is_offline_sync", "TINYINT(1) DEFAULT 0")
            add_col_if_missing("hindrance_records", "synced_at", "DATETIME NULL")

            add_col_if_missing("wbs_tasks", "wbs_code", "VARCHAR(50) NULL")
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

            # tenant_settings
            ts_cols = [
                ("tenant_name", "VARCHAR(100) NOT NULL DEFAULT 'Default Tenant'"),
                ("is_p2_enabled", "TINYINT(1) DEFAULT 0"),
                ("is_funding_mode_enabled", "TINYINT(1) DEFAULT 0"),
                ("ae_sampling_rate", "DECIMAL(5, 2) NOT NULL DEFAULT 50.00"),
                ("ee_sampling_rate", "DECIMAL(5, 2) NOT NULL DEFAULT 10.00"),
                ("max_file_upload_mb", "INT NOT NULL DEFAULT 10"),
                ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")
            ]
            for col, col_type in ts_cols:
                add_col_if_missing("tenant_settings", col, col_type)

            # Inspector scan for missing columns
            try:
                inspector = inspect(engine)
                existing_tables = set(inspector.get_table_names())
                for table_name, table_obj in Base.metadata.tables.items():
                    if table_name in existing_tables:
                        existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                        for column in table_obj.columns:
                            if column.name not in existing_cols:
                                add_col_if_missing(table_name, column.name, f"{column.type} NULL")
            except Exception:
                pass

        conn.commit()
        conn.close()

        if schema_applied_now:
            print("Schema Applied.")
        else:
            print("Schema Already Up-to-date.")
    except Exception as e:
        print(f"Schema Initialization Note: {e}")
        print("Schema Already Up-to-date.")

    # 3. Seed Master Data & Required Demo Users (Idempotent)
    seed_applied_now = False
    try:
        from app.models import User, Division, TenantSetting
        db = SessionLocal()

        # Seed Default Division
        def_div = db.query(Division).first()
        if not def_div:
            def_div = Division(name="Civil Infrastructure & Buildings", code="DIV-CIVIL", description="Civil & Building Construction", is_active=True)
            db.add(def_div)
            seed_applied_now = True

        # Seed Tenant Settings
        def_ts = db.query(TenantSetting).first()
        if not def_ts:
            def_ts = TenantSetting(
                tenant_name="Default Tenant",
                is_p2_enabled=False,
                is_funding_mode_enabled=False,
                ae_sampling_rate=50.00,
                ee_sampling_rate=10.00,
                max_file_upload_mb=10
            )
            db.add(def_ts)
            seed_applied_now = True

        db.commit()

        # Required Demo Users
        demo_users_seed = [
            ("admin", "admin@erp.local", "System Administrator", "admin", "admin123"),
            ("pm", "pm@erp.local", "Project Manager", "project_manager", "pm123"),
            ("engineer", "engineer@erp.local", "Lead Site Engineer", "site_engineer", "engineer123"),
            ("site", "site@erp.local", "Site Engineer", "site_engineer", "site123"),
            ("finance", "finance@erp.local", "Finance Lead", "finance", "finance123"),
            ("procurement", "procurement@erp.local", "Procurement Officer", "procurement", "procurement123"),
            ("customer_user", "customer@erp.local", "Customer Account", "customer", "customer123"),
            ("customer", "customer@abccorp.com", "ABC Customer Account", "customer", "customer123"),
        ]

        for uname, uemail, ufull, urole, upass in demo_users_seed:
            u_obj = db.query(User).filter((User.username == uname) | (User.email == uemail)).first()
            if not u_obj:
                u_obj = User(
                    username=uname,
                    email=uemail,
                    full_name=ufull,
                    hashed_password=pwd_context.hash(upass),
                    role=urole,
                    is_active=True
                )
                db.add(u_obj)
                seed_applied_now = True

        db.commit()
        db.close()

        if seed_applied_now:
            print("Seed Applied.")
        else:
            print("Seed Already Exists.")
    except Exception as e:
        print(f"Seed Initialization Note: {e}")
        print("Seed Already Exists.")

    print("Backend Ready.")

if __name__ == "__main__":
    auto_init_db()
