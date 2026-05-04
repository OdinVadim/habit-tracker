from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from typing import Optional

from .database import engine, Base, get_db
from . import models  # noqa: F401 — регистрация моделей в metadata

from sqlalchemy import func, cast, Date

from fastapi.security import OAuth2PasswordRequestForm, HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from .auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from .schema_migration import apply_schema_hotfixes
from .otp_service import normalize_email, create_send_otp, verify_otp


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_schema_hotfixes()
    yield


app = FastAPI(title="Habit Tracker API", lifespan=lifespan)

# CORS настройки
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Обработка preflight запросов
@app.options("/{path:path}")
async def options_handler(path: str):
    return {}


class HabitCreate(BaseModel):
    title: str
    habit_type: str = "binary"  # "binary" или "quantitative"
    target_value: Optional[int] = None
    unit: Optional[str] = None
    description: Optional[str] = None


class HabitOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    habit_type: str
    target_value: Optional[int] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

class HabitLogCreate(BaseModel):
    completed: Optional[bool] = None
    actual_value: Optional[int] = None
    note: Optional[str] = None

class HabitLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    habit_id: int
    log_date: date
    completed: Optional[bool]
    actual_value: Optional[int]
    note: Optional[str]
    created_at: datetime

class HabitStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    habit_id: int
    habit_title: str
    habit_type: str
    target_value: Optional[int] = None
    unit: Optional[str] = None
    total_days: int  # Всего дней в периоде
    completed_days: int  # Дней выполнено
    success_rate: float  # Процент успеха
    current_streak: int  # Текущая серия
    best_streak: int  # Лучшая серия
    logs: list[HabitLogOut]  # Детальные логи

# === Модели для аутентификации ===

class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: str  # Можно использовать email или username
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    username: str
    email_verified: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class TokenData(BaseModel):
    user_id: Optional[int] = None

class OtpSentResponse(BaseModel):
    message: str = "OTP_SENT"

class RegisterVerifyOtp(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=6)

class LoginVerifyOtp(BaseModel):
    identifier: str = Field(..., min_length=1, description="Email или username")
    code: str = Field(..., min_length=6, max_length=6)


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

# === ЗАВИСИМОСТИ ДЛЯ АУТЕНТИФИКАЦИИ ===
# Важно: объявлены ДО эндпоинтов, где используются.
http_bearer = HTTPBearer(auto_error=True)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> models.User:
    """Зависимость для получения текущего пользователя из токена"""
    credentials_exception = HTTPException(
        status_code=401,
        detail="Недействительные учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = creds.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: int = payload.get("user_id")
    if user_id is None:
        raise credentials_exception

    user = db.get(models.User, user_id)
    if user is None or not user.is_active or not user.email_verified:
        raise credentials_exception

    return user


@app.post("/api/habits", response_model=HabitOut)
def create_habit(
    payload: HabitCreate, 
    current_user: models.User = Depends(get_current_user),  # <-- Добавили
    db: Session = Depends(get_db)
):
    habit = models.Habit(
        user_id=current_user.id,  # <-- Используем user_id вместо client_id
        title=payload.title.strip(),
        habit_type=payload.habit_type,
        target_value=payload.target_value,
        unit=payload.unit,
        description=payload.description
    )
    
    if not habit.title:
        raise HTTPException(status_code=400, detail="title is required")
    
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@app.get("/api/habits", response_model=list[HabitOut])
def list_habits(
    current_user: models.User = Depends(get_current_user),  # Берём пользователя из токена
    db: Session = Depends(get_db)
):
    
    stmt = (
        select(models.Habit)
        .where(models.Habit.user_id == current_user.id)  # <-- Фильтр по пользователю
        .order_by(models.Habit.created_at.desc())
    )
    return list(db.scalars(stmt).all())


@app.post("/api/habits/{habit_id}/logs", response_model=HabitLogOut)
def create_habit_log(
    habit_id: int, 
    payload: HabitLogCreate, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, существует ли привычка
    habit = db.get(models.Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    # Проверяем, есть ли уже лог за сегодня
    today = date.today()
    existing_log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date == today
    ).first()
    
    if existing_log:
        # Обновляем существующий
        if payload.completed is not None:
            existing_log.completed = payload.completed
        if payload.actual_value is not None:
            existing_log.actual_value = payload.actual_value
        if payload.note is not None:
            existing_log.note = payload.note
        
        db.commit()
        db.refresh(existing_log)
        return existing_log
    else:
        # Создаём новый
        log = models.HabitLog(
            habit_id=habit_id,
            log_date=today,
            completed=payload.completed,
            actual_value=payload.actual_value,
            note=payload.note
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log
    
@app.get("/api/habits/{habit_id}/logs", response_model=list[HabitLogOut])
def get_habit_logs(
    habit_id: int, 
    days: int = 7,  # Сколько дней истории
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверяем, существует ли привычка
    habit = db.get(models.Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    from datetime import timedelta
    start_date = date.today() - timedelta(days=days)
    
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date >= start_date
    ).order_by(models.HabitLog.log_date.desc()).all()
    
    return logs


@app.get("/api/habits/{habit_id}", response_model=HabitOut)
def get_habit(
    habit_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    habit = db.get(models.Habit, habit_id)
    
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    return habit


@app.delete("/api/habits/{habit_id}")
def delete_habit(
    habit_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    habit = db.get(models.Habit, habit_id)
    
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    db.delete(habit)
    db.commit()
    
    return {"message": "Привычка удалена"}

@app.get("/api/habits/{habit_id}/today-log", response_model=Optional[HabitLogOut])
def get_today_log(habit_id: int, db: Session = Depends(get_db)):
    """Получить лог привычки за сегодня"""
    
    today = date.today()
    log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date == today
    ).first()
    
    return log


@app.post("/api/habits/{habit_id}/toggle", response_model=HabitLogOut)
def toggle_habit(habit_id: int, db: Session = Depends(get_db)):
    """Переключить статус бинарной привычки (выполнено/не выполнено)"""
    
    # Проверяем привычку
    habit = db.get(models.Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    if habit.habit_type != "binary":
        raise HTTPException(status_code=400, detail="Привычка не бинарная")
    
    today = date.today()
    
    # Ищем существующий лог
    log = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date == today
    ).first()
    
    if log:
        # Переключаем статус
        log.completed = not log.completed
        db.commit()
        db.refresh(log)
    else:
        # Создаём новый с completed=True
        log = models.HabitLog(
            habit_id=habit_id,
            log_date=today,
            completed=True
        )
        db.add(log)
        db.commit()
        db.refresh(log)
    
    return log

@app.get("/api/habits/{habit_id}/stats/weekly", response_model=HabitStats)
def get_weekly_stats(
    habit_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Статистика за последнюю неделю (7 дней)"""
    
    habit = db.get(models.Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    # Получаем логи за последние 7 дней
    end_date = date.today()
    start_date = end_date - timedelta(days=6)  # 7 дней включая сегодня
    
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date >= start_date,
        models.HabitLog.log_date <= end_date
    ).order_by(models.HabitLog.log_date).all()
    
    # Считаем выполненные дни
    if habit.habit_type == 'binary':
        completed_days = sum(1 for log in logs if log.completed)
    else:
        completed_days = sum(1 for log in logs if (log.actual_value or 0) > 0)
    
    # Считаем серии
    current_streak, best_streak = calculate_streaks(logs, habit.habit_type)
    
    return HabitStats(
        habit_id=habit_id,
        habit_title=habit.title,
        habit_type=habit.habit_type,
        target_value=habit.target_value,
        unit=habit.unit,
        total_days=7,
        completed_days=completed_days,
        success_rate=round((completed_days / 7) * 100, 1) if completed_days else 0,
        current_streak=current_streak,
        best_streak=best_streak,
        logs=logs
    )


@app.get("/api/habits/{habit_id}/stats/monthly", response_model=HabitStats)
def get_monthly_stats(
    habit_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Статистика за последний месяц (30 дней)"""
    
    habit = db.get(models.Habit, habit_id)
    if not habit:
        raise HTTPException(status_code=404, detail="Привычка не найдена")
    
    # Проверяем, что привычка принадлежит текущему пользователю
    if habit.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этой привычке")
    
    # Получаем логи за последние 30 дней
    end_date = date.today()
    start_date = end_date - timedelta(days=29)  # 30 дней включая сегодня
    
    logs = db.query(models.HabitLog).filter(
        models.HabitLog.habit_id == habit_id,
        models.HabitLog.log_date >= start_date,
        models.HabitLog.log_date <= end_date
    ).order_by(models.HabitLog.log_date).all()
    
    # Считаем выполненные дни
    if habit.habit_type == 'binary':
        completed_days = sum(1 for log in logs if log.completed)
    else:
        completed_days = sum(1 for log in logs if (log.actual_value or 0) > 0)
    
    # Считаем серии
    current_streak, best_streak = calculate_streaks(logs, habit.habit_type)
    
    return HabitStats(
        habit_id=habit_id,
        habit_title=habit.title,
        habit_type=habit.habit_type,
        target_value=habit.target_value,
        unit=habit.unit,
        total_days=30,
        completed_days=completed_days,
        success_rate=round((completed_days / 30) * 100, 1) if completed_days else 0,
        current_streak=current_streak,
        best_streak=best_streak,
        logs=logs
    )


def calculate_streaks(logs: list, habit_type: str) -> tuple[int, int]:
    """
    Вычисляет текущую и лучшую серию выполнений
    
    Возвращает: (current_streak, best_streak)
    """
    if not logs:
        return 0, 0
    
    # Сортируем логи по дате
    sorted_logs = sorted(logs, key=lambda x: x.log_date, reverse=True)
    
    # Проверяем, была ли привычка выполнена сегодня или вчера
    today = date.today()
    yesterday = today - timedelta(days=1)
    
    if sorted_logs[0].log_date not in [today, yesterday]:
        # Если последний лог был больше чем вчера, серия прервалась
        return 0, 0
    
    # Считаем текущую серию
    current_streak = 0
    expected_date = sorted_logs[0].log_date
    
    for log in sorted_logs:
        # Проверяем, выполнена ли привычка
        is_completed = False
        if habit_type == 'binary':
            is_completed = log.completed == True
        else:
            is_completed = (log.actual_value or 0) > 0
        
        if is_completed and log.log_date == expected_date:
            current_streak += 1
            expected_date -= timedelta(days=1)
        elif log.log_date < expected_date:
            # Пропущен день
            break
    
    # Считаем лучшую серию
    best_streak = 0
    temp_streak = 0
    expected_date = None
    
    for log in sorted(logs, key=lambda x: x.log_date):
        is_completed = False
        if habit_type == 'binary':
            is_completed = log.completed == True
        else:
            is_completed = (log.actual_value or 0) > 0
        
        if is_completed:
            if expected_date is None or log.log_date == expected_date:
                temp_streak += 1
                expected_date = log.log_date + timedelta(days=1)
            elif log.log_date > expected_date:
                # Новый день, начинаем новую серию
                temp_streak = 1
                expected_date = log.log_date + timedelta(days=1)
            
            best_streak = max(best_streak, temp_streak)
        else:
            temp_streak = 0
            expected_date = log.log_date + timedelta(days=1)
    
    return current_streak, best_streak

# === ЭНДПОИНТЫ АУТЕНТИФИКАЦИИ ===

def _find_user_by_login_identifier(db: Session, identifier: str) -> Optional[models.User]:
    """Поиск пользователя по email или username (как при логине)."""
    ident = identifier.strip()
    if "@" in ident:
        email = normalize_email(ident)
        return db.query(models.User).filter(models.User.email == email).first()
    return db.query(models.User).filter(models.User.username == ident).first()


@app.post("/api/auth/register/request-otp", response_model=OtpSentResponse)
def register_request_otp(user_data: UserRegister, db: Session = Depends(get_db)):
    """Шаг 1 регистрации: создать/обновить неподтверждённого пользователя и отправить код на email."""
    email = normalize_email(str(user_data.email))

    u_email = db.query(models.User).filter(models.User.email == email).first()
    u_name = db.query(models.User).filter(models.User.username == user_data.username).first()

    if u_email and u_email.email_verified:
        return OtpSentResponse()

    if u_name and (not u_email or u_name.id != u_email.id):
        return OtpSentResponse()

    if u_email and not u_email.email_verified:
        u_email.username = user_data.username
        u_email.hashed_password = get_password_hash(user_data.password)
        db.commit()
        db.refresh(u_email)
        try:
            sent = create_send_otp(db, u_email, "register", throttle=True)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e)) from e
        if not sent:
            raise HTTPException(
                status_code=429,
                detail="Подождите перед повторной отправкой кода",
            )
        return OtpSentResponse()

    user = models.User(
        email=email,
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    try:
        sent = create_send_otp(db, user, "register", throttle=True)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    if not sent:
        raise HTTPException(
            status_code=429,
            detail="Подождите перед повторной отправкой кода",
        )
    return OtpSentResponse()


@app.post("/api/auth/register/verify-otp", response_model=Token)
def register_verify_otp(payload: RegisterVerifyOtp, db: Session = Depends(get_db)):
    """Шаг 2 регистрации: подтвердить код из письма и получить JWT."""
    email = normalize_email(str(payload.email))
    user = (
        db.query(models.User)
        .filter(models.User.email == email, models.User.email_verified.is_(False))
        .first()
    )
    if not user or not verify_otp(db, user, "register", payload.code):
        raise HTTPException(status_code=400, detail="Неверный код или email")

    user.email_verified = True
    db.commit()
    db.refresh(user)

    access_token = create_access_token(
        data={"user_id": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@app.post("/api/auth/login", response_model=OtpSentResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Шаг 1 входа: проверка пароля и отправка кода на email."""
    user = _find_user_by_login_identifier(db, form_data.username)

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Аккаунт не активен")

    if not user.email_verified:
        raise HTTPException(
            status_code=401,
            detail="Сначала подтвердите email по коду из письма при регистрации",
        )

    try:
        sent = create_send_otp(db, user, "login", throttle=True)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    if not sent:
        raise HTTPException(
            status_code=429,
            detail="Подождите перед повторной отправкой кода",
        )

    return OtpSentResponse()


@app.post("/api/auth/login/verify-otp", response_model=Token)
def login_verify_otp(payload: LoginVerifyOtp, db: Session = Depends(get_db)):
    """Шаг 2 входа: проверка кода из письма и выдача JWT."""
    user = _find_user_by_login_identifier(db, payload.identifier)

    if not user or not user.is_active or not user.email_verified:
        raise HTTPException(status_code=400, detail="Неверный код или данные")

    if not verify_otp(db, user, "login", payload.code):
        raise HTTPException(status_code=400, detail="Неверный код или данные")

    access_token = create_access_token(
        data={"user_id": user.id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    user.last_login = datetime.utcnow()
    db.commit()

    return Token(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Получить данные текущего пользователя"""
    return current_user


@app.post("/api/auth/logout")
def logout(_creds: HTTPAuthorizationCredentials = Depends(http_bearer)):
    """Выход (на клиенте нужно удалить токен)"""
    # В реальном приложении здесь можно добавить blacklist токенов
    return {"message": "Выход выполнен"}