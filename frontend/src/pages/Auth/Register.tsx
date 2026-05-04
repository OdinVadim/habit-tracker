import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, REGISTER_OTP_REQUIRED } from '../../context/AuthContext';
import TwoFactorModal from '../../components/TwoFactorModal';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);

  const { registerStep1, verifyRegisterEmailOtp, error, isLoading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      alert('Пароли не совпадают');
      return;
    }

    try {
      await registerStep1(email, username, password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === REGISTER_OTP_REQUIRED) {
        setShowOtp(true);
      }
    }
  }

  async function handleOtpSubmit(code: string) {
    try {
      await verifyRegisterEmailOtp(email, code);
      setShowOtp(false);
      navigate('/dashboard');
    } catch {
      // ошибка показана в модалке
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>📝 Регистрация</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || showOtp}
            />
          </div>

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              disabled={isLoading || showOtp}
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading || showOtp}
            />
          </div>

          <div className="form-group">
            <label>Подтвердите пароль</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={isLoading || showOtp}
            />
          </div>

          {error && !showOtp && <p className="error">{error}</p>}

          <button type="submit" disabled={isLoading || showOtp}>
            {isLoading ? 'Загрузка...' : 'Отправить код на email'}
          </button>
        </form>

        <p>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>

      {showOtp && (
        <TwoFactorModal
          description={`Код отправлен на ${email.trim()}`}
          onClose={() => setShowOtp(false)}
          onVerify={handleOtpSubmit}
        />
      )}
    </div>
  );
}
