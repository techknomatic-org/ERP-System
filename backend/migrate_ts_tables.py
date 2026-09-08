import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.database import engine, Base
from app.models import TechnicalSanction

def migrate():
    print("Migrating TechnicalSanction table...")
    Base.metadata.create_all(bind=engine, tables=[TechnicalSanction.__table__])
    print("Migration complete!")

if __name__ == "__main__":
    migrate()
