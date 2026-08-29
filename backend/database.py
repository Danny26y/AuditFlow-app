import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from model import Base, FarmerRegistry

# ------------------------------------------------------------------------------
# Load Environment Variables from backend/.env
# ------------------------------------------------------------------------------
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ENV_FILE = os.path.join(BACKEND_DIR, ".env")
if os.path.exists(ENV_FILE):
    load_dotenv(dotenv_path=ENV_FILE, override=True)
else:
    load_dotenv(override=True)


def resolve_database_url() -> str:
    """
    Resolves the active database connection URL in priority order:
    1. DATABASE_URL / SUPABASE_DB_URL / SUPABASE_DATABASE_URL / POSTGRES_URL / POSTGRESQL_URL
    2. Discrete parameters (POSTGRES_HOST/SUPABASE_DB_HOST, user, password, port, db)
    3. Fallback to local SQLite database for offline dev and testing.
    """
    raw_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("SUPABASE_DB_URL")
        or os.getenv("SUPABASE_DATABASE_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRESQL_URL")
    )

    if raw_url and raw_url.strip():
        url = raw_url.strip()
        # Normalize deprecated postgres:// prefix to postgresql:// for SQLAlchemy 2.0+
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        return url

    # Check discrete PostgreSQL / Supabase variables
    db_host = os.getenv("POSTGRES_HOST") or os.getenv("SUPABASE_DB_HOST")
    db_user = os.getenv("POSTGRES_USER") or os.getenv("SUPABASE_DB_USER") or "postgres"
    db_password = os.getenv("POSTGRES_PASSWORD") or os.getenv("SUPABASE_DB_PASSWORD")
    db_port = os.getenv("POSTGRES_PORT") or os.getenv("SUPABASE_DB_PORT") or "5432"
    db_name = os.getenv("POSTGRES_DB") or os.getenv("SUPABASE_DB_NAME") or "postgres"

    if db_host and db_password:
        return f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

    # Default fallback: Local SQLite database
    default_sqlite_path = os.path.join(BACKEND_DIR, "field_registry_master.db")
    return f"sqlite:///{default_sqlite_path}"


def get_masked_db_url(url: str) -> str:
    """Masks database user password in logs for SEC audit safety."""
    if not url:
        return ""
    return re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", url)


# ------------------------------------------------------------------------------
# Engine & Session Configuration
# ------------------------------------------------------------------------------
DATABASE_URL = resolve_database_url()
is_postgres = DATABASE_URL.startswith("postgresql")

if is_postgres:
    # Production-ready PostgreSQL connection pooling for Supabase / Cloud Postgres
    engine = create_engine(
        DATABASE_URL,
        pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
        max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
        pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
        pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "1800")), # Recycle connection every 30m
        pool_pre_ping=True, # Proactively detect dropped/idle cloud connections
    )
else:
    # Local SQLite Engine
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ------------------------------------------------------------------------------
# Database Initialization & Cross-Dialect Column Migration
# ------------------------------------------------------------------------------
def init_db():
    """
    Initializes and creates all database tables if they do not exist,
    and performs cross-database auto-migration for newly added columns.
    """
    try:
        Base.metadata.create_all(bind=engine)
        masked_url = get_masked_db_url(DATABASE_URL)
        print(f"[init_db] Database schema verified successfully on {masked_url}")
    except Exception as e:
        print(f"[init_db] Warning during schema creation: {e}")

    # Dialect-agnostic column verification (works for PostgreSQL & SQLite)
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        if "farmer_registry" in table_names:
            existing_cols = {col["name"] for col in inspector.get_columns("farmer_registry")}

            for col in FarmerRegistry.__table__.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(engine.dialect)
                    quote_col = f'"{col.name}"' if is_postgres else f"[{col.name}]"
                    with engine.connect() as conn:
                        conn.execute(text(f"ALTER TABLE farmer_registry ADD COLUMN {quote_col} {col_type}"))
                        conn.commit()
                    print(f"[init_db] Auto-migrated missing column: {col.name} ({col_type})")
    except Exception as e:
        print(f"[init_db] Note on column migration: {e}")


def get_db():
    """FastAPI Dependency providing a transactional database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_status() -> dict:
    """
    Verifies live database connectivity and returns metadata for health checks.
    """
    is_connected = False
    error_message = None
    dialect_name = engine.dialect.name

    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            is_connected = True
    except Exception as e:
        error_message = str(e)

    pool_info = {
        "pool_type": engine.pool.__class__.__name__,
        "size": engine.pool.size() if hasattr(engine.pool, "size") else 1,
        "checkedin": engine.pool.checkedin() if hasattr(engine.pool, "checkedin") else None,
        "checkedout": engine.pool.checkedout() if hasattr(engine.pool, "checkedout") else None,
        "overflow": engine.pool.overflow() if hasattr(engine.pool, "overflow") else None,
    }

    return {
        "connected": is_connected,
        "dialect": dialect_name,
        "is_production_postgres": is_postgres,
        "target": get_masked_db_url(DATABASE_URL),
        "pool": pool_info,
        "error": error_message,
    }
