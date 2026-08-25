import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from model import Base, FarmerRegistry

# Supports PostgreSQL in production or local SQLite database
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "field_registry_master.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes and creates all database tables if they do not exist, and migrates missing columns."""
    Base.metadata.create_all(bind=engine)

    # Auto-migration for SQLite database to ensure newly added model columns exist
    if DATABASE_URL.startswith("sqlite"):
        try:
            with engine.connect() as conn:
                res = conn.execute(text("PRAGMA table_info(farmer_registry)"))
                existing_cols = {row[1] for row in res.fetchall()}
                
                # Check and add missing columns dynamically
                for col in FarmerRegistry.__table__.columns:
                    if col.name not in existing_cols:
                        col_type = col.type.compile(engine.dialect)
                        conn.execute(text(f"ALTER TABLE farmer_registry ADD COLUMN {col.name} {col_type}"))
                        conn.commit()
        except Exception as e:
            print(f"[init_db] Note on column migration: {e}")

def get_db():
    """FastAPI Dependency providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
