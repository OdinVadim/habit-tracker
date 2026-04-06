from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

_raw_url = os.getenv("DATABASE_URL", "sqlite:///./habit_tracker.db").strip()
# Драйвер psycopg (v3) для SQLAlchemy: postgresql+psycopg://
if _raw_url.startswith("postgresql://") and not _raw_url.startswith("postgresql+"):
    DATABASE_URL = "postgresql+psycopg://" + _raw_url.removeprefix("postgresql://")
else:
    DATABASE_URL = _raw_url

_connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_engine(DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
