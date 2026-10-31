import { useState, type FormEvent } from 'react';
import { errorMessage } from '../lib/errorMessage';

interface LoginScreenProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  initialError?: string | null;
}

export function LoginScreen({ onSubmit, initialError }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ? errorMessage(new Error(initialError)) : null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page" id="main-content">
      <div className="login-intro">
        <span className="eyebrow">Piccole esplorazioni, grandi ricordi</span>
        <p className="login-headline">Ogni avventura<br />ha il suo posto.</p>
        <p>Un album condiviso. Una mappa da riempire.<br />Tutte le vostre storie, insieme.</p>
        <div className="login-stamps" aria-hidden="true"><span>☀</span><span>✿</span><span>⌁</span></div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="card form-stack login-card"
        aria-busy={submitting}
      >
        <span className="brand-icon" aria-hidden="true">B.</span>
        <h1>Bianca's Adventures</h1>
        <p className="muted">Accedi al tuo diario di viaggio.</p>
        <label htmlFor="email" style={{ fontWeight: 700 }}>
          Email
        </label>
        <input
          id="email"
          type="email"
          className="input"
          required
          autoComplete="email"
          disabled={submitting}
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
          required
          autoComplete="current-password"
          disabled={submitting}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Accesso in corso…' : 'Accedi'}
        </button>
        {error && (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
