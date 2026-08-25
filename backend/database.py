import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from model import Base

# Supports PostgreSQL in production or local SQLite database
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "field_registry_master.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes and creates all database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """FastAPI Dependency providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
