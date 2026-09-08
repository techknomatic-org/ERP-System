import pymysql
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
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
    print("=== MIGRATING PROJECT ESTIMATION TABLES SCHEMA IN MYSQL ===")
    connection = pymysql.connect(
        host=settings.DB_HOST,
        port=int(settings.DB_PORT),
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME
    )
    cursor = connection.cursor()
    db_name = settings.DB_NAME

    # Project Estimates
    add_column_if_missing(cursor, db_name, "project_estimates", "base_amount", "DECIMAL(14, 2) DEFAULT 0.00")
    add_column_if_missing(cursor, db_name, "project_estimates", "contingency_percent", "DECIMAL(5, 2) DEFAULT 5.00")
    add_column_if_missing(cursor, db_name, "project_estimates", "contingency_amount", "DECIMAL(14, 2) DEFAULT 0.00")
    add_column_if_missing(cursor, db_name, "project_estimates", "departmental_charges_percent", "DECIMAL(5, 2) DEFAULT 2.00")
    add_column_if_missing(cursor, db_name, "project_estimates", "departmental_charges_amount", "DECIMAL(14, 2) DEFAULT 0.00")
    add_column_if_missing(cursor, db_name, "project_estimates", "is_ee_review_required", "TINYINT(1) DEFAULT 0")
    add_column_if_missing(cursor, db_name, "project_estimates", "ee_review_reason", "TEXT NULL")
    add_column_if_missing(cursor, db_name, "project_estimates", "ts_status", "VARCHAR(30) DEFAULT 'PENDING'")
    add_column_if_missing(cursor, db_name, "project_estimates", "is_ts_locked", "TINYINT(1) DEFAULT 0")
    add_column_if_missing(cursor, db_name, "project_estimates", "revision_number", "INT DEFAULT 0")
    add_column_if_missing(cursor, db_name, "project_estimates", "original_estimate_id", "INT NULL")
    add_column_if_missing(cursor, db_name, "project_estimates", "is_revised", "TINYINT(1) DEFAULT 0")

    # Project Estimate Lines
    add_column_if_missing(cursor, db_name, "project_estimate_lines", "rate_source", "VARCHAR(30) DEFAULT 'SOR'")
    add_column_if_missing(cursor, db_name, "project_estimate_lines", "manual_rate", "DECIMAL(12, 2) NULL")
    add_column_if_missing(cursor, db_name, "project_estimate_lines", "is_manual_override", "TINYINT(1) DEFAULT 0")
    add_column_if_missing(cursor, db_name, "project_estimate_lines", "justification_note", "TEXT NULL")
    
    # Modify quantity column to DECIMAL(12, 3) for 3-decimal precision
    cursor.execute("ALTER TABLE project_estimate_lines MODIFY COLUMN quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000;")
    print("[+] Updated 'quantity' column in 'project_estimate_lines' to DECIMAL(12, 3)")

    connection.commit()
    cursor.close()
    connection.close()
    print("[+] Estimation schema migration completed successfully!")

if __name__ == '__main__':
    run_migration()
