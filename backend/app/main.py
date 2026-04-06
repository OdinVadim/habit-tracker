from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from . import models  # noqa: F401 — регистрация моделей в metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Habit Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HabitCreate(BaseModel):
    client_id: str
    title: str


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: str
    title: str
    created_at: datetime


def _db_ping(db: Session) -> None:
    db.execute(text("SELECT 1"))


@app.get("/")
def read_root():
    return {"message": "Привет! API работает 🚀"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        _db_ping(db)
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={"status": "error", "database": "disconnected", "error": str(e)},
        ) from e


@app.get("/api/db/ping")
def api_db_ping(db: Session = Depends(get_db)):
    try:
        _db_ping(db)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"database unreachable: {e!s}") from e
    return {"ok": True}


@app.post("/api/habits", response_model=HabitOut)
def create_habit(payload: HabitCreate, db: Session = Depends(get_db)):
    habit = models.Habit(client_id=payload.client_id.strip(), title=payload.title.strip())
    if not habit.client_id or not habit.title:
        raise HTTPException(status_code=400, detail="client_id and title are required")
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@app.get("/api/habits", response_model=list[HabitOut])
def list_habits(client_id: str, db: Session = Depends(get_db)):
    cid = client_id.strip()
    if not cid:
        raise HTTPException(status_code=400, detail="client_id is required")
    stmt = (
        select(models.Habit)
        .where(models.Habit.client_id == cid)
        .order_by(models.Habit.created_at.desc())
    )
    return list(db.scalars(stmt).all())
