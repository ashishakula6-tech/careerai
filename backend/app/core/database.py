from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.core.config import settings


# Render's DATABASE_URL uses postgres:// but SQLAlchemy needs postgresql://
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = "sqlite" in db_url

engine_kwargs = {"echo": False}
if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    # PostgreSQL connection pooling for production
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_size"] = 5
    engine_kwargs["max_overflow"] = 10
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(db_url, **engine_kwargs)

if is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dependency that provides a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Retries on connection failure — Render's PostgreSQL
    can take 30–60s to accept connections after first provisioning."""
    import time
    from sqlalchemy.exc import OperationalError

    max_retries = 12
    for attempt in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            print(f"[init_db] Connected and created tables on attempt {attempt + 1}")
            break
        except OperationalError as e:
            if attempt < max_retries - 1:
                wait = min(2 ** attempt, 30)
                print(f"[init_db] DB not ready (attempt {attempt + 1}/{max_retries}), retrying in {wait}s")
                time.sleep(wait)
            else:
                print(f"[init_db] Failed after {max_retries} attempts: {e}")
                raise

    # Add new columns to existing tables (safe, idempotent)
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            if is_sqlite:
                for col_sql in [
                    "ALTER TABLE candidates ADD COLUMN phone VARCHAR(50)",
                    "ALTER TABLE candidates ADD COLUMN password_hash VARCHAR(255)",
                ]:
                    try:
                        conn.execute(text(col_sql))
                        conn.commit()
                    except Exception:
                        pass  # column already exists
            else:
                conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS phone VARCHAR(50)"))
                conn.execute(text("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)"))
                conn.commit()
    except Exception as e:
        print(f"[init_db] Column migration note: {e}")
