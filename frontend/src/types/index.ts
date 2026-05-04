export interface Habit {
  id: number;
  user_id: number;  
  title: string;
  habit_type: 'binary' | 'quantitative';
  target_value?: number;
  unit?: string;
  description?: string;
  created_at: string;
}

export interface HabitCreate {
  title: string;
  habit_type?: 'binary' | 'quantitative';
  target_value?: number;
  unit?: string;
  description?: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  completed?: boolean;
  actual_value?: number;
  note?: string;
  created_at: string;
}

export interface HabitLogCreate {
  completed?: boolean;
  actual_value?: number;
  note?: string;
}


export interface HabitStats {
  habit_id: number;
  habit_title: string;
  habit_type: 'binary' | 'quantitative';
  target_value?: number;
  unit?: string;
  total_days: number;
  completed_days: number;
  success_rate: number;
  current_streak: number;
  best_streak: number;
  logs: HabitLog[];
}


// === Аутентификация ===

export interface UserRegister {
  email: string;
  username: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface User {
  id: number;
  email: string;
  username: string;
  email_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface OtpSentResponse {
  message: string;
}

