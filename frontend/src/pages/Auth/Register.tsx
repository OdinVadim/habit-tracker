import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, REGISTER_OTP_REQUIRED } from '../../context/AuthContext';
import TwoFactorModal from '../../components/TwoFactorModal';

const PENDING_REGISTER_EMAIL_KEY = 'pending_register_email';

export default function Register() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpHint, setOtpHint] = useState('Введите код из письма для завершения регистрации.');

  const { registerStep1, verifyRegisterEmailOtp, error, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_REGISTER_EMAIL_KEY);
    if (pending) {
      setEmail(pending);
    }
  }, []);

  function openOtpModal(hint: string) {
    if (email.trim()) {
      sessionStorage.setItem(PENDING_REGISTER_EMAIL_KEY, email.trim());
    }
    setOtpHint(hint);
    setShowOtp(true);
  }

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
        openOtpModal(`Код отправлен на ${email.trim()}`);
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

          <button type="submit" disabled={isLoading || showOtp} style={{ marginBottom: '10px' }}>
            {isLoading ? 'Загрузка...' : 'Отправить код на email'}
          </button>

          <button
            type="button"
            disabled={isLoading || showOtp || !email.trim()}
            onClick={() =>
              openOtpModal(
                `Введите код из письма на ${email.trim() || 'ваш email'}.`
              )
            }
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '14px',
              cursor: 'pointer',
              borderRadius: '4px',
              border: '1px solid #ccc',
              background: '#fff',
            }}
          >
            У меня уже есть код
          </button>
        </form>

        <p>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>

      {showOtp && (
        <TwoFactorModal
          description={otpHint}
          onClose={() => setShowOtp(false)}
          onVerify={handleOtpSubmit}
        />
      )}
    </div>
  );
}
