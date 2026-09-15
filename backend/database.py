"""Database configuration shared by the FastAPI application and migrations."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


# This module is imported by both FastAPI and Alembic. Load the backend-local
# configuration before reading DATABASE_URL in either execution path.
load_dotenv(Path(__file__).with_name(".env"))


def get_database_url() -> str:
    """Return a SQLAlchemy URL for SQLite or a Neon PostgreSQL URL."""
    database_url = os.getenv("DATABASE_URL", "sqlite:///./smart_cv_matcher.db")
    # Neon supplies standard PostgreSQL URLs. SQLAlchemy needs this dialect name
    # to use psycopg (version 3), which is included in requirements.txt.
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


DATABASE_URL = get_database_url()
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
