import { useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../store';
import { go } from '../router';
import { ADMIN_EMAILS } from '../config';
import { passwordStrength } from '../auth';
import { Field, Icon } from '../components/ui';

/**
 * Email + password sign-in. Passwords are hashed (PBKDF2) before storage, accounts lock
 * after repeated failures and sessions expire. See src/auth.ts and src/store.tsx.
 * For production, replace register()/login() with a server-side auth provider.
 */
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['bg-steel-200', 'bg-bad', 'bg-forge', 'bg-forge', 'bg-ok'];

export function Login({ reason, inPlace }: { reason?: string; inPlace: boolean }) {
  const { register, login } = useApp();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';
  const strength = passwordStrength(password);

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setPassword('');
    setConfirm('');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (isRegister && password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    const err = isRegister ? await register(email, name, password) : await login(email, password);
    setBusy(false);
    if (err) {
      setError(err);
      setPassword('');
      setConfirm('');
      return;
    }
    if (!inPlace) {
      // role state updates after this handler, so compare against the config directly
      const isAdmin = ADMIN_EMAILS.map((a) => a.toLowerCase()).includes(email.trim().toLowerCase());
      go(isAdmin ? 'admin' : 'home');
    }
  };

  return (
    <div className="wrap flex justify-center py-14">
      <form className="panel w-full max-w-md space-y-5 p-6 sm:p-8" onSubmit={submit} noValidate>
        <div>
          <Icon name="user" className="h-8 w-8 text-ink-500" />
          <h1 className="mt-2 text-4xl font-semibold">{isRegister ? 'Create account' : 'Sign in'}</h1>
          <p className="mt-1 text-sm text-ink-700">
            {reason ?? (isRegister ? 'Register with your email and a password to check out and track your orders.' : 'Sign in with your email and password.')}
          </p>
        </div>

        <div role="tablist" aria-label="Account" className="grid grid-cols-2 border border-steel-300">
          <button type="button" role="tab" aria-selected={!isRegister} onClick={() => switchMode('login')} className={`px-3 py-2 text-sm font-semibold ${!isRegister ? 'bg-ink text-white' : 'bg-white hover:bg-steel-100'}`}>
            Sign in
          </button>
          <button type="button" role="tab" aria-selected={isRegister} onClick={() => switchMode('register')} className={`px-3 py-2 text-sm font-semibold ${isRegister ? 'bg-ink text-white' : 'bg-white hover:bg-steel-100'}`}>
            Create account
          </button>
        </div>

        {isRegister ? (
          <Field label="Your name" htmlFor="login-name">
            <input id="login-name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        ) : null}

        <Field label="Email address" htmlFor="login-email">
          <input
            id="login-email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" hint={isRegister ? 'At least 8 characters with upper and lower case letters and a number.' : undefined}>
          <div className="relative">
            <input
              id="login-password"
              type={show ? 'text' : 'password'}
              className="field !pr-16"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
            />
            <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-ink-500 hover:text-ink" onClick={() => setShow((v) => !v)} aria-pressed={show}>
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>

        {isRegister ? (
          <>
            <div aria-live="polite">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`h-1.5 flex-1 ${strength >= i ? STRENGTH_COLOR[strength] : 'bg-steel-200'}`} />
                ))}
              </div>
              <p className="mt-1 text-xs text-ink-500">{password ? `Password strength: ${STRENGTH_LABEL[strength]}` : ' '}</p>
            </div>
            <Field label="Confirm password" htmlFor="login-confirm">
              <input id="login-confirm" type={show ? 'text' : 'password'} className="field" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
          </>
        ) : null}

        {error ? (
          <p className="text-sm font-medium text-bad" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn-dark w-full" disabled={busy}>
          {busy ? 'Checking…' : isRegister ? 'Create account' : 'Sign in'}
        </button>
        <p className="text-xs text-ink-500">
          Passwords are stored only as salted hashes. After 5 wrong attempts sign-in locks for 5 minutes, and you are signed out automatically after 8 hours.
        </p>
      </form>
    </div>
  );
}
