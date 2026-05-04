import { useState, useEffect } from 'react';
import { getWeeklyStats, getMonthlyStats } from '../services/api';
import type { HabitStats as HabitStatsType } from '../types';
import './HabitStats.css';

interface HabitStatsProps {
  habitId: number;
  habitType: string;
  targetValue?: number;
  unit?: string;
  onClose: () => void;
}

export default function HabitStats({ 
  habitId, 
  habitType, 
  targetValue: _targetValue, 
  unit,
  onClose 
}: HabitStatsProps) {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [stats, setStats] = useState<HabitStatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [habitId, period]);

  async function loadStats() {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Не авторизован');
      }
      
      const data = period === 'weekly' 
        ? await getWeeklyStats(token, habitId)  // <-- Передаём token
        : await getMonthlyStats(token, habitId);  // <-- Передаём token
        
      setStats(data);
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
    } finally {
      setLoading(false);
    }
  }

  

  if (loading) {
    return <div className="stats-loading">Загрузка статистики...</div>;
  }

  if (!stats) {
    return <div className="stats-error">Не удалось загрузить статистику</div>;
  }

  // Создаём массив дней для отображения
  const days = [];
  const today = new Date();
  const totalDays = period === 'weekly' ? 7 : 30;
  
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Ищем лог за этот день
    const log = stats.logs.find(l => l.log_date === dateStr);
    
    let completed = false;
    let value = 0;
    
    if (log) {
      if (habitType === 'binary') {
        completed = log.completed === true;
      } else {
        value = log.actual_value || 0;
        completed = value > 0;
      }
    }
    
    days.push({
      date: dateStr,
      dayName: date.toLocaleDateString('ru-RU', { weekday: 'short' }),
      dayNumber: date.getDate(),
      completed,
      value
    });
  }

  return (
    <div className="stats-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-header">
          <h2>📊 {stats.habit_title}</h2>
          <button className="stats-close" onClick={onClose}>×</button>
        </div>

        {/* Переключатель периода */}
        <div className="stats-period-selector">
          <button
            className={period === 'weekly' ? 'active' : ''}
            onClick={() => setPeriod('weekly')}
          >
            За неделю
          </button>
          <button
            className={period === 'monthly' ? 'active' : ''}
            onClick={() => setPeriod('monthly')}
          >
            За месяц
          </button>
        </div>

        {/* Общая статистика */}
        <div className="stats-summary">
          <div className="stat-card">
            <div className="stat-value">{stats.completed_days}</div>
            <div className="stat-label">дней выполнено</div>
            <div className="stat-subtitle">из {stats.total_days}</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats.success_rate}%</div>
            <div className="stat-label">успешность</div>
            <div className="stat-subtitle">
              {stats.success_rate >= 80 ? ' Отлично!' : 
               stats.success_rate >= 50 ? '💪 Хорошо!' : '📈 Можно лучше'}
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats.current_streak} 🔥</div>
            <div className="stat-label">текущая серия</div>
            <div className="stat-subtitle">лучшая: {stats.best_streak}</div>
          </div>
        </div>

        {/* Календарь/сетка дней */}
        <div className="stats-calendar">
          <h3>Детали по дням</h3>
          <div className="calendar-grid">
            {days.map((day, index) => (
              <div
                key={index}
                className={`calendar-day ${day.completed ? 'completed' : 'missed'}`}
                title={`${day.date}: ${day.completed ? 
                  (habitType === 'binary' ? 'Выполнено' : `${day.value} ${unit}`) : 
                  'Не выполнено'}`}
              >
                <div className="day-name">{day.dayName}</div>
                <div className="day-number">{day.dayNumber}</div>
                {day.completed && habitType === 'quantitative' && (
                  <div className="day-value">{day.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Легенда */}
        <div className="stats-legend">
          <div className="legend-item">
            <div className="legend-color completed"></div>
            <span>Выполнено</span>
          </div>
          <div className="legend-item">
            <div className="legend-color missed"></div>
            <span>Не выполнено</span>
          </div>
        </div>
      </div>
    </div>
  );
}