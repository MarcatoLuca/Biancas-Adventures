import { useState, type FormEvent } from 'react';

interface LoginScreenProps {
  onSubmit: (email: string, password: string) => Promise<void>;
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSubmit(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error');
    }
  }

  return (
    <div
      style={{
        minHeight: '100svh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, var(--color-sky) 0%, var(--color-grass) 100%)',
        padding: 16,
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="card"
        style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <h1 style={{ textAlign: 'center', color: 'var(--color-coral-dark)' }}>
          🗺️ Bianca's Adventures
        </h1>
        <label htmlFor="email" style={{ fontWeight: 700 }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label htmlFor="password" style={{ fontWeight: 700 }}>
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" style={{ marginTop: 6 }}>
          🚀 Accedi
        </button>
        {error && (
          <p role="alert" style={{ color: 'var(--color-coral-dark)', fontWeight: 700 }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
