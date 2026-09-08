import pymysql
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def run_migration():
    print("=== MIGRATING NON-SOR RATE ANALYSIS TABLES SCHEMA IN MYSQL ===")
    connection = pymysql.connect(
        host=settings.DB_HOST,
        port=int(settings.DB_PORT),
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        database=settings.DB_NAME
    )
    cursor = connection.cursor()
    db_name = settings.DB_NAME

    create_table_sql = """
    CREATE TABLE IF NOT EXISTS non_sor_rate_analyses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        project_id INT NOT NULL,
        boq_item_id INT NULL,
        item_description TEXT NOT NULL,
        unit VARCHAR(30) NULL,
        market_rate_source VARCHAR(50) NOT NULL,
        market_rate DECIMAL(12, 2) NOT NULL,
        supporting_document_id INT NULL,
        supporting_document_path TEXT NULL,
        supporting_document_name TEXT NULL,
        analysis_remarks TEXT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'PENDING_EE_REVIEW',
        rate_type VARCHAR(30) NOT NULL DEFAULT 'Market Rate',
        is_reconciled TINYINT(1) NOT NULL DEFAULT 0,
        reconciled_sor_id INT NULL,
        created_by_id INT NOT NULL,
        reviewed_by_id INT NULL,
        reviewed_at DATETIME NULL,
        rejection_reason TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (boq_item_id) REFERENCES boq_items(id),
        FOREIGN KEY (created_by_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """
    cursor.execute(create_table_sql)
    print("[+] Table 'non_sor_rate_analyses' created or verified successfully!")

    connection.commit()
    cursor.close()
    connection.close()
    print("[+] Migration completed successfully!")

if __name__ == '__main__':
    run_migration()
