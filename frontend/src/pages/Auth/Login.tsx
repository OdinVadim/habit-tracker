import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, LOGIN_OTP_REQUIRED } from '../../context/AuthContext';
import TwoFactorModal from '../../components/TwoFactorModal';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);

  const { login, verifyLoginEmailOtp, error, isLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === LOGIN_OTP_REQUIRED) {
        setShowOtp(true);
      }
    }
  }

  async function handleOtpSubmit(code: string) {
    try {
      await verifyLoginEmailOtp(code);
      setShowOtp(false);
      navigate('/dashboard');
    } catch {
      // Ошибка в модалке
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🔐 Вход</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email или username</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {error && !showOtp && <p className="error">{error}</p>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Загрузка...' : 'Отправить код на email'}
          </button>
        </form>

        <p>
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </div>

      {showOtp && (
        <TwoFactorModal
          description="Мы отправили 6-значный код на email, привязанный к аккаунту. Введите его ниже."
          onClose={() => setShowOtp(false)}
          onVerify={handleOtpSubmit}
        />
      )}
    </div>
  );
}
