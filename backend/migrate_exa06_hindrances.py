import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import TenantSetting, Hindrance, HindranceAudit
from sqlalchemy import inspect, text

def run_migration():
    print("Running EXA-06 migration...")
    inspector = inspect(engine)

    # 1. Add max_file_upload_mb to tenant_settings if missing
    columns = [col['name'] for col in inspector.get_columns('tenant_settings')]
    if 'max_file_upload_mb' not in columns:
        print("Adding max_file_upload_mb column to tenant_settings...")
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE tenant_settings ADD COLUMN max_file_upload_mb INTEGER DEFAULT 10"))

    # 2. Create hindrance_records and hindrance_audits tables
    print("Creating tables for Hindrance feature...")
    Base.metadata.create_all(bind=engine)

    print("EXA-06 Migration Completed Successfully!")

if __name__ == "__main__":
    run_migration()
