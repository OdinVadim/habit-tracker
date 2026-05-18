import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, LOGIN_OTP_REQUIRED } from '../../context/AuthContext';
import TwoFactorModal from '../../components/TwoFactorModal';

const PENDING_LOGIN_KEY = 'pending_login_id';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpHint, setOtpHint] = useState(
    'Введите 6-значный код из письма, привязанного к аккаунту.'
  );

  const { login, verifyLoginEmailOtp, error, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_LOGIN_KEY);
    if (pending) {
      setEmail(pending);
    }
  }, []);

  function openOtpModal(hint: string) {
    const id = email.trim();
    if (id) {
      sessionStorage.setItem(PENDING_LOGIN_KEY, id);
    }
    setOtpHint(hint);
    setShowOtp(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === LOGIN_OTP_REQUIRED) {
        openOtpModal(
          'Код отправлен на email. Если письмо не пришло сразу, проверьте папку «Спам».'
        );
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

          <button type="submit" disabled={isLoading} style={{ marginBottom: '10px' }}>
            {isLoading ? 'Загрузка...' : 'Отправить код на email'}
          </button>

          <button
            type="button"
            disabled={isLoading || !email.trim()}
            onClick={() =>
              openOtpModal(
                'Введите код из последнего письма. Новое письмо можно запросить кнопкой выше через несколько секунд.'
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
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
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
