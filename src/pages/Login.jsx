import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LockKeyhole, Waves } from 'lucide-react';
import { navigate } from '../router';
import { getSession, isSupabaseAuthConfigured, signIn, signUp } from '../auth';
import './Login.css';

export default function Login() {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getSession().then((session) => { if (session) navigate('/profile'); });
  }, []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (password.length < 6) {
      setError('Use a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const session = mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name.trim());
      if (session?.access_token) {
        navigate('/profile');
      } else {
        setMessage('Account created. Check your email to confirm the account, then sign in.');
        setMode('signin');
      }
    } catch (authError) {
      setError(authError.message || 'Authentication failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-shell">
        <a className="login-brand" href="#/" aria-label="FLOATCHAT home">
          <span className="login-brand__mark"><Waves size={18} /></span>
          <span>FLOATCHAT<small>Ocean intelligence</small></span>
        </a>
        <section className="login-panel" aria-labelledby="login-title">
          <div className="login-kicker"><LockKeyhole size={14} /> SECURE ACCOUNT ACCESS</div>
          <h1 id="login-title">{mode === 'signin' ? 'Welcome back.' : 'Start your ocean workspace.'}</h1>
          <p className="login-lede">
            {mode === 'signin'
              ? 'Sign in to manage your profile, thresholds, and saved account settings.'
              : 'Create an account to keep your FloatChat profile and alert preferences across sessions.'}
          </p>
          {!isSupabaseAuthConfigured && (
            <div className="login-message login-message--warning" role="status">
              Supabase Auth is not configured for this deployment yet. Add the public Supabase URL and anon key to enable login.
            </div>
          )}
          {message && <div className="login-message" role="status"><CheckCircle2 size={15} />{message}</div>}
          {error && <div className="login-message login-message--error" role="alert">{error}</div>}
          <form onSubmit={submit}>
            {mode === 'signup' && (
              <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
            )}
            <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required /></label>
            <button className="login-submit" type="submit" disabled={busy || !isSupabaseAuthConfigured}>
              {busy ? 'Checking credentials…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
          <button className="login-switch" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>
            {mode === 'signin' ? 'First time here? Create an account' : 'Already have an account? Sign in'}
          </button>
        </section>
        <p className="login-footnote">ARGO data remains available to viewers without an account. Account access is for personal settings and profile persistence.</p>
      </div>
    </main>
  );
}
