/**
 * Shown instead of the app when required Supabase env vars are missing.
 * Prevents a silent blank screen when `frontend/.env.local` hasn't been
 * created yet (see `.env.local.example`).
 */
export function ConfigErrorScreen() {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '10vh auto', textAlign: 'left' }}>
      <h1 className="app-title" style={{ fontSize: '1.5rem' }}>
        ⚙️ Configurazione mancante
      </h1>
      <p>
        Non è stato trovato il file <code>frontend/.env.local</code>, oppure mancano le
        variabili <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>.
      </p>
      <p>
        Copia <code>frontend/.env.local.example</code> in <code>frontend/.env.local</code> e
        inserisci i valori del tuo progetto Supabase (Project Settings → API), poi riavvia{' '}
        <code>npm run dev</code>.
      </p>
    </div>
  );
}
