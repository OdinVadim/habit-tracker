import { useState, useEffect } from 'react';
import { getHabits, createHabit, checkHealth } from './services/api';
import type { Habit } from './types';
import './App.css';

// Временный ID пользователя (потом сделаем нормальную авторизацию)
const CLIENT_ID = 'user_123';

function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serverStatus, setServerStatus] = useState('');

  // Загрузка привычек при старте
  useEffect(() => {
    loadHabits();
    checkServerHealth();
  }, []);

  async function loadHabits() {
    try {
      setLoading(true);
      const data = await getHabits(CLIENT_ID);
      setHabits(data);
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
      const status = await checkHealth();
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

    try {
      await createHabit({
        client_id: CLIENT_ID,
        title: newHabitTitle,
      });
      
      setNewHabitTitle('');
      loadHabits(); // Обновить список
    } catch (err) {
      alert('Ошибка при создании привычки');
      console.error(err);
    }
  }

  return (
    <div className="app">
      <h1>🎯 Habit Tracker</h1>
      
      {/* Статус сервера */}
      <div style={{ marginBottom: '20px', color: serverStatus.includes('✅') ? 'green' : 'red' }}>
        {serverStatus}
      </div>

      {/* Форма создания */}
      <form onSubmit={handleCreateHabit} style={{ marginBottom: '30px' }}>
        <input
          type="text"
          value={newHabitTitle}
          onChange={(e) => setNewHabitTitle(e.target.value)}
          placeholder="Название привычки..."
          style={{
            padding: '10px',
            fontSize: '16px',
            width: '300px',
            marginRight: '10px',
          }}
        />
        <button 
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Добавить
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
        
        <ul style={{ listStyle: 'none' }}>
          {habits.map((habit) => (
            <li 
              key={habit.id}
              style={{
                padding: '15px',
                marginBottom: '10px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <strong>{habit.title}</strong>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '5px' }}>
                Создано: {new Date(habit.created_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;