const API_URL = 'http://127.0.0.1:8000';

export async function getHabits(clientId: string) {
  const response = await fetch(`${API_URL}/api/habits?client_id=${clientId}`);
  
  if (!response.ok) {
    throw new Error('Ошибка при получении привычек');
  }
  
  return await response.json();
}

export async function createHabit(habit: { client_id: string; title: string }) {
  const response = await fetch(`${API_URL}/api/habits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(habit),
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при создании привычки');
  }
  
  return await response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);
  return await response.json();
}