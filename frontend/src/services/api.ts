import type { AuthResponse, UserRegister } from '../types';

// === КОНСТАНТЫ ===

const API_URL = 'http://127.0.0.1:8000';

function formatApiDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return (
      detail
        .map((item) =>
          typeof item === 'object' && item !== null && 'msg' in item
            ? String((item as { msg: string }).msg)
            : ''
        )
        .filter(Boolean)
        .join('; ') || 'Ошибка запроса'
    );
  }
  if (typeof detail === 'object' && detail !== null) return JSON.stringify(detail);
  return 'Ошибка запроса';
}

// === АУТЕНТИФИКАЦИЯ ===

/** Шаг 1 регистрации: отправка кода на email */
export async function requestRegisterOtp(userData: UserRegister): Promise<{ message: string }> {
  const response = await fetch(`${API_URL}/api/auth/register/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(formatApiDetail(error.detail) || 'Ошибка регистрации');
  }

  return await response.json();
}

/** Шаг 2 регистрации: подтверждение кода */
export async function verifyRegisterOtp(email: string, code: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(formatApiDetail(error.detail) || 'Неверный код');
  }

  return await response.json();
}

export type PasswordLoginResponse = { message: string };

// Вход: шаг 1 — после верного пароля приходит OTP_SENT (код на email)
export async function login(
  identifier: string,
  password: string
): Promise<PasswordLoginResponse> {
  const formData = new FormData();
  formData.append('username', identifier); // OAuth2: поле username = email или login
  formData.append('password', password);
  
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(formatApiDetail(error.detail) || 'Ошибка входа');
  }

  return await response.json();
}

/** Шаг 2 входа: проверка кода из email */
export async function verifyLoginOtp(identifier: string, code: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ identifier, code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(formatApiDetail(error.detail) || 'Неверный код');
  }

  return await response.json();
}

// Получить данные текущего пользователя
export async function getMe(token: string) {
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Не авторизован');
  }
  
  return await response.json();
}

// Выход (на клиенте удаляем токен)
export async function logout(token: string) {
  const response = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return await response.json();
}

// === ПРИВЫЧКИ ===

// Получить все привычки текущего пользователя
export async function getHabits(token: string) {
  const response = await fetch(`${API_URL}/api/habits`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при получении привычек');
  }
  
  return await response.json();
}

// Создать новую привычку
export async function createHabit(token: string, habit: {
  title: string;
  habit_type?: 'binary' | 'quantitative';
  target_value?: number;
  unit?: string;
  description?: string;
}) {
  const response = await fetch(`${API_URL}/api/habits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(habit),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка при создании привычки' }));
    throw new Error(error.detail || 'Ошибка при создании привычки');
  }
  
  return await response.json();
}

// Получить одну привычку по ID
export async function getHabit(token: string, habitId: number) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при получении привычки');
  }
  
  return await response.json();
}

// Удалить привычку
export async function deleteHabit(token: string, habitId: number) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при удалении привычки');
  }
  
  return await response.json();
}

// === ЛОГИ ПРИВЫЧЕК ===

// Создать/обновить лог привычки (отметить выполнение)
export async function createHabitLog(
  token: string,
  habitId: number,
  log: {
    completed?: boolean;
    actual_value?: number;
    note?: string;
  }
) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(log),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка при сохранении прогресса' }));
    throw new Error(error.detail || 'Ошибка при сохранении прогресса');
  }
  
  return await response.json();
}

// Получить логи привычки за последние N дней
export async function getHabitLogs(token: string, habitId: number, days: number = 7) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}/logs?days=${days}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при получении истории');
  }
  
  return await response.json();
}

// === СТАТИСТИКА ===

// Получить статистику за неделю
export async function getWeeklyStats(token: string, habitId: number) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}/stats/weekly`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при получении недельной статистики');
  }
  
  return await response.json();
}

// Получить статистику за месяц
export async function getMonthlyStats(token: string, habitId: number) {
  const response = await fetch(`${API_URL}/api/habits/${habitId}/stats/monthly`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  if (!response.ok) {
    throw new Error('Ошибка при получении месячной статистики');
  }
  
  return await response.json();
}

// === ЗДОРОВЬЕ API ===

// Проверить, работает ли сервер
export async function checkHealth() {
  const response = await fetch(`${API_URL}/health`);
  
  if (!response.ok) {
    throw new Error('Сервер недоступен');
  }
  
  return await response.json();
}