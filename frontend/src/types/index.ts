export interface Habit {
  id: number;
  client_id: string;
  title: string;
  habit_type?: 'binary' | 'quantitative';
  target_value?: number;
  unit?: string;
  created_at: string;
}

export interface HabitCreate {
  client_id: string;
  title: string;
}

export interface HabitLog {
  id: number;
  habit_id: number;
  log_date: string;
  completed?: boolean;
  actual_value?: number;
  note?: string;
}