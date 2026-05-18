from sqlalchemy import (
    Column, DateTime, Integer, String, Boolean,
    Date, ForeignKey, UniqueConstraint, func, Index,
)
from sqlalchemy.orm import relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    username = Column(String(100), nullable=False, unique=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    # Поля оставлены для совместимости со старой схемой БД (TOTP больше не используется)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    two_factor_secret = Column(String(255), nullable=True)

    # Подтверждение email (одноразовые коды по почте)
    email_verified = Column(Boolean, default=False, nullable=False)

    # Метаданные
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_login = Column(DateTime, nullable=True)
    
    # Связь с привычками
    habits = relationship("Habit", back_populates="user", cascade="all, delete-orphan")
    # Индексы создаются через `index=True` на колонках email/username.
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}')>"


class EmailOtp(Base):
    __tablename__ = "email_otps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    purpose = Column(String(20), nullable=False)  # "register" | "login"
    code_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    consumed_at = Column(DateTime, nullable=True)
    attempts_left = Column(Integer, nullable=False, default=5)
    created_at = Column(DateTime, nullable=False)
    sent_to_email = Column(String(255), nullable=False)

    user = relationship("User", backref="email_otps")

    __table_args__ = (
        Index("ix_email_otps_user_purpose_created", "user_id", "purpose", "created_at"),
    )


# Обновляем Habit: добавляем связь с User
class Habit(Base):
    __tablename__ = "habits"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # <-- НОВОЕ
    title = Column(String(500), nullable=False)
    
    habit_type = Column(String(20), nullable=False, default="binary")
    target_value = Column(Integer, nullable=True)
    unit = Column(String(50), nullable=True)
    description = Column(String(1000), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Связь с пользователем и логами
    user = relationship("User", back_populates="habits")
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_habits_user_id', 'user_id'),
    )


class HabitLog(Base):
    __tablename__ = "habit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    
    completed = Column(Boolean, nullable=True)
    actual_value = Column(Integer, nullable=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    habit = relationship("Habit", back_populates="logs")
    
    __table_args__ = (
        UniqueConstraint('habit_id', 'log_date', name='uq_habit_log_date'),
        Index('ix_logs_habit_date', 'habit_id', 'log_date'),
    )