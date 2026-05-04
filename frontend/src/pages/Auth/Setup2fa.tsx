import { Link } from 'react-router-dom';

/** Ранее: настройка TOTP; сейчас коды отправляются на email при входе и регистрации. */
export default function Setup2fa() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>🔐 Двухфакторная защита</h1>
        <p>
          В проекте используется подтверждение входа одноразовым кодом, который приходит{' '}
          <strong>на email</strong> после ввода пароля (или при регистрации — после заполнения
          формы).
        </p>
        <p>Настройте SMTP для backend (см. <code>.env.example</code> в папке backend).</p>
        <p>
          <Link to="/">На главную</Link>
        </p>
      </div>
    </div>
  );
}
