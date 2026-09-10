import sys
import os
from sqlalchemy import text

# Add backend directory to sys.path
backend_dir = os.path.dirname(__file__)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import engine, Base
import app.models  # Ensure models are loaded

def migrate_db():
    print("--- RUNNING EXA-03 DATABASE MIGRATION ---")
    
    # 1. Create any missing tables using Base metadata
    Base.metadata.create_all(bind=engine)
    print("Base metadata create_all completed.")

    # 2. Safely add missing columns to tenant_settings
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE tenant_settings ADD COLUMN ae_sampling_rate NUMERIC(5, 2) DEFAULT 50.00 NOT NULL;"))
            print("Added ae_sampling_rate column to tenant_settings")
        except Exception as e:
            print(f"ae_sampling_rate column note: {e}")

        try:
            conn.execute(text("ALTER TABLE tenant_settings ADD COLUMN ee_sampling_rate NUMERIC(5, 2) DEFAULT 10.00 NOT NULL;"))
            print("Added ee_sampling_rate column to tenant_settings")
        except Exception as e:
            print(f"ee_sampling_rate column note: {e}")

        conn.commit()
    print("MIGRATION COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    migrate_db()
