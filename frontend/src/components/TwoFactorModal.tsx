import { useState } from 'react';

interface TwoFactorModalProps {
  onClose: () => void;
  onVerify: (code: string) => Promise<void>;
  description?: string;
}

export default function TwoFactorModal({
  onClose,
  onVerify,
  description = 'Введите 6-значный код из письма на вашей почте.',
}: TwoFactorModalProps) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (code.length !== 6) {
      setError('Код должен содержать 6 цифр');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      await onVerify(code);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>📧 Подтверждение по email</h2>

        <p>{description}</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              setCode(value);
              setError('');
            }}
            placeholder="000000"
            className="two-factor-input"
            autoFocus
            disabled={loading}
          />
          
          {error && <p className="error">{error}</p>}
          
          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={loading}>
              Отмена
            </button>
            <button type="submit" disabled={loading || code.length !== 6}>
              {loading ? 'Проверка...' : 'Подтвердить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}