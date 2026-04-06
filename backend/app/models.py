from sqlalchemy import (
    Column, DateTime, Integer, String, Boolean, 
    Date, ForeignKey, UniqueConstraint, func, Index
)
from sqlalchemy.orm import relationship
from .database import Base


class Habit(Base):
    __tablename__ = "habits"
    
    # Поля
    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(String(255), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    
    # Тип привычки: "binary" или "quantitative"
    habit_type = Column(String(20), nullable=False)  # "binary" | "quantitative"
    
    # Для количественных привычек
    target_value = Column(Integer, nullable=True)  # Цель: 50 страниц
    unit = Column(String(50), nullable=True)       # Единица: "страницы"
    
    # Дополнительно
    description = Column(String(1000), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Связь с логами (удобно для запросов)
    logs = relationship("HabitLog", back_populates="habit", cascade="all, delete-orphan")
    
    # Индексы для быстрых запросов
    __table_args__ = (
        Index('ix_habits_client_id', 'client_id'),
    )
    
    def __repr__(self):
        return f"<Habit(id={self.id}, title='{self.title}', type='{self.habit_type}')>"


class HabitLog(Base):
    __tablename__ = "habit_logs"
    
    # Поля
    id = Column(Integer, primary_key=True, autoincrement=True)
    habit_id = Column(Integer, ForeignKey("habits.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    
    # Для бинарных привычек
    completed = Column(Boolean, nullable=True)  # True/False для binary
    
    # Для количественных привычек
    actual_value = Column(Integer, nullable=True)  # 30 страниц из 50
    
    # Дополнительно
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Связь с привычкой
    habit = relationship("Habit", back_populates="logs")
    
    # Уникальность: один лог на привычку в день + индексы
    __table_args__ = (
        UniqueConstraint('habit_id', 'log_date', name='uq_habit_log_date'),
        Index('ix_logs_habit_date', 'habit_id', 'log_date'),
    )
    
    def __repr__(self):
        return f"<HabitLog(id={self.id}, date={self.log_date}, habit_id={self.habit_id})>"