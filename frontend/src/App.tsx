import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { 
  getHabits, 
  createHabit, 
  deleteHabit,
  createHabitLog,
  getHabitLogs,
  checkHealth 
} from './services/api';
import type { Habit, HabitLog, HabitCreate } from './types';
import HabitStats from './components/HabitStats';
import './App.css';

function App() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('');
  
  // Форма создания привычки
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitType, setNewHabitType] = useState<'binary' | 'quantitative'>('binary');
  const [newTargetValue, setNewTargetValue] = useState('');
  const [newUnit, setNewUnit] = useState('');
  
  // Прогресс по привычкам за сегодня
  const [todayLogs, setTodayLogs] = useState<Record<number, HabitLog>>({});
  
  // Показ статистики
  const [showingStats, setShowingStats] = useState<number | null>(null);

  useEffect(() => {
    loadHabits();
    checkServerHealth();
  }, []);

  async function loadHabits() {
  try {
    setLoading(true);
    
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Не авторизован');
    }
    
    const data = await getHabits(token);  // <-- Передаём token
    setHabits(data);
    
    // Загружаем логи за СЕГОДНЯ для каждой привычки
    const logsMap: Record<number, HabitLog> = {};
    const today = new Date().toISOString().split('T')[0];
    
    for (const habit of data) {
      const logs = await getHabitLogs(token, habit.id, 1);  // <-- Передаём token
      const todayLog = logs.find((log: HabitLog) => log.log_date === today);
      if (todayLog) {
        logsMap[habit.id] = todayLog;
      }
    }
    setTodayLogs(logsMap);
    
    setError('');
  } catch (err) {
    setError('Не удалось загрузить привычки');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

  async function checkServerHealth() {
    try {
      await checkHealth();
      setServerStatus('Сервер работает ✅');
    } catch (err) {
      setServerStatus('Сервер недоступен ❌');
    }
  }

  async function handleCreateHabit(e: React.FormEvent) {
  e.preventDefault();
  
  if (!newHabitTitle.trim()) {
    alert('Введите название привычки');
    return;
  }

  const token = localStorage.getItem('auth_token');
  if (!token) {
    alert('Не авторизован');
    return;
  }

  try {
    const habitData: HabitCreate = {
      title: newHabitTitle,
      habit_type: newHabitType,
    };
    
    if (newHabitType === 'quantitative') {
      habitData.target_value = parseInt(newTargetValue) || 0;
      habitData.unit = newUnit || 'шт';
    }
    
    await createHabit(token, habitData);  // <-- Передаём token
    
    setNewHabitTitle('');
    setNewHabitType('binary');
    setNewTargetValue('');
    setNewUnit('');
    
    loadHabits();
  } catch (err) {
    alert('Ошибка при создании привычки');
    console.error(err);
  }
  }

  async function handleMarkComplete(habitId: number, habitType: string) {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    alert('Не авторизован');
    return;
  }

  try {
    if (habitType === 'binary') {
      await createHabitLog(token, habitId, { completed: true });  // <-- Передаём token
    } else {
      const value = prompt('Сколько выполнено? (например, 30 страниц)');
      if (value) {
        await createHabitLog(token, habitId, {   // <-- Передаём token
          actual_value: parseInt(value) || 0 
        });
      } else {
        return;
      }
    }
    
    loadHabits();
  } catch (err) {
    alert('Ошибка при сохранении прогресса');
    console.error(err);
  }
  }

  async function handleDeleteHabit(habitId: number) {
  if (!confirm('Вы уверены, что хотите удалить эту привычку?')) {
    return;
  }
  
  const token = localStorage.getItem('auth_token');
  if (!token) {
    alert('Не авторизован');
    return;
  }
  
  try {
    await deleteHabit(token, habitId);  // <-- Передаём token
    loadHabits();
  } catch (err) {
    alert('Ошибка при удалении привычки');
    console.error(err);
  }
  }

  function openStats(habitId: number) {
    setShowingStats(habitId);
  }

  function isCompletedToday(habitId: number, habitType: string): boolean {
    const log = todayLogs[habitId];
    if (!log) return false;
    
    if (habitType === 'binary') {
      return log.completed === true;
    } else {
      return (log.actual_value || 0) > 0;
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
  <div className="app">
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '8px',
      }}
    >
      <h1 style={{ margin: 0 }}>🎯 Habit Tracker</h1>
      <button
        type="button"
        onClick={handleLogout}
        style={{
          padding: '8px 14px',
          fontSize: '14px',
          cursor: 'pointer',
          borderRadius: '4px',
          border: '1px solid #ccc',
          background: '#f5f5f5',
        }}
      >
        Выйти
      </button>
    </div>

    {/* Статус сервера */}
    <div style={{ 
      marginBottom: '20px', 
      color: serverStatus.includes('✅') ? 'green' : 'red',
      fontSize: '14px'
    }}>
      {serverStatus}
    </div>

    {/* Форма создания */}
    <form onSubmit={handleCreateHabit} style={{ 
      marginBottom: '30px',
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ marginBottom: '15px' }}>Создать привычку</h2>
      
      <div style={{ marginBottom: '15px' }}>
        <input
          type="text"
          value={newHabitTitle}
          onChange={(e) => setNewHabitTitle(e.target.value)}
          placeholder="Название привычки..."
          style={{
            padding: '10px',
            fontSize: '16px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '10px' }}>Тип:</label>
        <select 
          value={newHabitType} 
          onChange={(e) => setNewHabitType(e.target.value as 'binary' | 'quantitative')}
          style={{ padding: '8px', fontSize: '14px' }}
        >
          <option value="binary">Бинарная (выполнено/нет)</option>
          <option value="quantitative">Количественная (с числом)</option>
        </select>
      </div>
      
      {newHabitType === 'quantitative' && (
        <>
          <div style={{ marginBottom: '15px' }}>
            <input
              type="number"
              value={newTargetValue}
              onChange={(e) => setNewTargetValue(e.target.value)}
              placeholder="Цель (например, 50)"
              style={{
                padding: '10px',
                fontSize: '16px',
                width: '150px',
                marginRight: '10px',
              }}
            />
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Единицы (страницы, минуты)"
              style={{
                padding: '10px',
                fontSize: '16px',
                width: '200px',
              }}
            />
          </div>
        </>
      )}
      
      <button 
        type="submit"
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Создать привычку
      </button>
    </form>

    {/* Список привычек */}
    <div>
      <h2>Мои привычки</h2>
      
      {loading && <p>Загрузка...</p>}
      
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!loading && habits.length === 0 && (
        <p>Пока нет привычек. Создайте первую!</p>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {habits.map((habit) => {
          const completed = isCompletedToday(habit.id, habit.habit_type);
          
          return (
            <div 
              key={habit.id}
              style={{
                padding: '15px',
                backgroundColor: completed ? '#e8f5e9' : 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                border: completed ? '2px solid #4CAF50' : '2px solid transparent',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '18px' }}>{habit.title}</strong>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                    Тип: {habit.habit_type === 'binary' ? '✅/❌' : `📊 ${habit.target_value} ${habit.unit}`}
                  </div>
                  {habit.habit_type === 'quantitative' && todayLogs[habit.id] && (
                    <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                      Сегодня: {todayLogs[habit.id].actual_value} из {habit.target_value} {habit.unit}
                      {todayLogs[habit.id].actual_value && (
                        <div style={{ 
                          marginTop: '5px', 
                          width: '100%', 
                          height: '8px', 
                          backgroundColor: '#e0e0e0',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min((todayLogs[habit.id].actual_value! / (habit.target_value || 1)) * 100, 100)}%`,
                            height: '100%',
                            backgroundColor: '#4CAF50',
                            transition: 'width 0.3s'
                          }}></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => handleMarkComplete(habit.id, habit.habit_type)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: completed ? '#4CAF50' : '#2196F3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {completed ? '✓ Выполнено' : 'Отметить'}
                  </button>
                  
                  <button 
                    onClick={() => openStats(habit.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#9C27B0',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    📊 Статистика
                  </button>
                  
                  <button 
                    onClick={() => handleDeleteHabit(habit.id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

    {/* Модальное окно статистики */}
    {showingStats && (
      <HabitStats
        habitId={showingStats}
        habitType={habits.find(h => h.id === showingStats)?.habit_type || 'binary'}
        targetValue={habits.find(h => h.id === showingStats)?.target_value}
        unit={habits.find(h => h.id === showingStats)?.unit}
        onClose={() => setShowingStats(null)}
      />
    )}
  </div>
);
}

export default App;