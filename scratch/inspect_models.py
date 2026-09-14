import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import Base, SessionLocal, engine
import app.models as models
import inspect
from sqlalchemy import inspect as sa_inspect

def inspect_models():
    print("Listing all mapped models with project references:")
    for name, cls in inspect.getmembers(models, inspect.isclass):
        if issubclass(cls, Base) and hasattr(cls, "__tablename__"):
            table = cls.__table__
            project_fks = [c.name for c in table.columns if c.name == "project_id" or any(fk.column.table.name == "projects" for fk in c.foreign_keys)]
            if project_fks or table.name == "projects":
                print(f"Model: {name:30s} | Table: {table.name:25s} | Project Cols: {project_fks}")

if __name__ == "__main__":
    inspect_models()
