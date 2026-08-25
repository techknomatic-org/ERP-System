import pymysql
import sys
sys.path.append(r'c:\Users\khushi.gurave\Desktop\ERP\backend')
from app.config import settings

def add_column_if_missing(cursor, db_name, table_name, column_name, column_def):
    cursor.execute("""
        SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_schema = %s AND table_name = %s AND column_name = %s;
    """, (db_name, table_name, column_name))
    count = cursor.fetchone()[0]
    if count == 0:
        sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def};"
        cursor.execute(sql)
        print(f"[+] Added column '{column_name}' to table '{table_name}'")
    else:
        print(f"[-] Column '{column_name}' already exists in table '{table_name}'")

def run_migration():
    print("=== MIGRATING PROCUREMENT TABLES SCHEMA IN MYSQL ===")
    connection = pymysql.connect(
        host=settings.DB_HOST,
        port=int(settings.DB_PORT),
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME
    )
    cursor = connection.cursor()
    db_name = settings.DB_NAME

    # Material Purchase Requests
    add_column_if_missing(cursor, db_name, "material_purchase_requests", "wbs_phase_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "material_purchase_requests", "wbs_task_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "material_purchase_requests", "wbs_subtask_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "material_purchase_requests", "estimated_unit_rate", "DECIMAL(12, 2) NULL")

    # Purchase Requisitions
    add_column_if_missing(cursor, db_name, "purchase_requisitions", "wbs_phase_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_requisitions", "wbs_task_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_requisitions", "wbs_subtask_id", "INT NULL")

    # Purchase Orders
    add_column_if_missing(cursor, db_name, "purchase_orders", "mpr_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "wbs_phase_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "wbs_task_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "wbs_subtask_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "unit", "VARCHAR(50) DEFAULT 'unit'")
    add_column_if_missing(cursor, db_name, "purchase_orders", "po_date", "DATETIME NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "expected_delivery_date", "DATETIME NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "payment_terms", "VARCHAR(255) NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "delivery_terms", "VARCHAR(255) NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "remarks", "TEXT NULL")
    add_column_if_missing(cursor, db_name, "purchase_orders", "created_by_id", "INT NULL")

    connection.commit()
    cursor.close()
    connection.close()
    print("[+] Schema migration completed successfully!")

if __name__ == '__main__':
    run_migration()
