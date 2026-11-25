import { useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import {
  claimStallWithPassword,
  signInStallWithPassword,
} from '../services/firestoreStall';
import type { StallId } from '../types/stall';

const FIREBASE_AUTH_PROVIDERS_URL =
  'https://console.firebase.google.com/project/fluid-meridian-2wpgt/authentication/providers';

function mapAuthError(err: unknown): { message: string; needsProviderEnable?: boolean } {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const msg = err instanceof Error ? err.message : String(err);

  if (code === 'auth/operation-not-allowed' || msg.includes('PASSWORD_LOGIN_DISABLED')) {
    return {
      message:
        'Enable Email/Password sign-in in Firebase Console before signing in.',
      needsProviderEnable: true,
    };
  }
  if (code === 'auth/email-already-in-use') {
    return { message: 'Password already set for this stall. Switch to Sign In.' };
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return { message: 'Incorrect password, or stall password is not set yet.' };
  }
  if (code === 'auth/weak-password') {
    return { message: 'Password must be at least 6 characters.' };
  }
  if (code === 'auth/too-many-requests') {
    return { message: 'Too many attempts. Wait a moment and try again.' };
  }
  return { message: msg || 'Sign in failed.' };
}

export function LoginGate() {
  const [stallId, setStallId] = useState<StallId>(() => {
    const param = new URLSearchParams(window.location.search).get('stall');
    return param === 'gamingzone' ? 'gamingzone' : 'rushbox';
  });
  const [mode, setMode] = useState<'login' | 'claim'>('login');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);

  function switchStall(next: StallId) {
    setStallId(next);
    setError(null);
    setNeedsProviderEnable(false);
    setPassword('');
    setConfirmPassword('');
  }

  function switchMode(next: 'login' | 'claim') {
    setMode(next);
    setError(null);
    setNeedsProviderEnable(false);
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNeedsProviderEnable(false);

    if (mode === 'claim') {
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    } else if (!password) {
      setError('Enter your stall password.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'claim') {
        await claimStallWithPassword(stallId, password);
      } else {
        await signInStallWithPassword(stallId, password);
      }
    } catch (err) {
      const mapped = mapAuthError(err);
      setError(mapped.message);
      setNeedsProviderEnable(Boolean(mapped.needsProviderEnable));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F8] flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#0C0C10] border border-[#1E1E28] rounded-2xl p-7">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold tracking-wide uppercase text-white">
            {stallId === 'rushbox' ? 'RushBox' : 'GamingZone'}
          </h1>
          <Lock className="w-4 h-4 text-[#8E8E9E]" aria-hidden="true" />
        </div>

        <div
          role="group"
          aria-label="Select stall"
          className="mt-5 grid grid-cols-2 gap-1 p-1 bg-[#050507] border border-[#1E1E28] rounded-xl"
        >
          <button
            type="button"
            onClick={() => switchStall('rushbox')}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              stallId === 'rushbox'
                ? 'bg-[#3DD9EB] text-[#050507]'
                : 'text-[#8E8E9E] hover:text-white'
            }`}
          >
            rushbox
          </button>
          <button
            type="button"
            onClick={() => switchStall('gamingzone')}
            className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              stallId === 'gamingzone'
                ? 'bg-[#3DD9EB] text-[#050507]'
                : 'text-[#8E8E9E] hover:text-white'
            }`}
          >
            gamingzone
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div>
            <label htmlFor="stall-password" className="block text-xs font-medium text-[#8E8E9E]">
              {mode === 'claim' ? 'Set stall password (6+ chars)' : 'Password'}
            </label>
            <input
              id="stall-password"
              type="password"
              required
              autoComplete={mode === 'claim' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="mt-1.5 w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
            />
          </div>

          {mode === 'claim' && (
            <div>
              <label
                htmlFor="stall-password-confirm"
                className="block text-xs font-medium text-[#8E8E9E]"
              >
                Confirm password
              </label>
              <input
                id="stall-password-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="mt-1.5 w-full px-3.5 py-2.5 text-sm bg-[#050507] border border-[#242430] rounded-lg text-white placeholder:text-[#555566] focus:outline-none focus:border-[#3DD9EB]"
              />
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-[#FF6FB5]/10 border border-[#FF6FB5]/40 text-xs text-[#FF6FB5] space-y-1.5"
            >
              <p>{error}</p>
              {needsProviderEnable && (
                <a
                  href={FIREBASE_AUTH_PROVIDERS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block underline text-[#3DD9EB] hover:text-white"
                >
                  Open Firebase Authentication Providers
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-[#3DD9EB] text-[#050507] text-sm font-semibold rounded-lg hover:brightness-110 transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? mode === 'claim'
                ? 'Setting up...'
                : 'Signing in...'
              : mode === 'claim'
                ? `Set Password & Enter ${stallId}`
                : `Sign In to ${stallId}`}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-[#1E1E28] text-center">
          <button
            type="button"
            onClick={() => switchMode(mode === 'login' ? 'claim' : 'login')}
            className="text-xs text-[#8E8E9E] hover:text-[#3DD9EB] transition-colors cursor-pointer"
          >
            {mode === 'login'
              ? `First time setting up ${stallId}? Set password`
              : `Already set a password for ${stallId}? Sign in`}
          </button>
        </div>
      </div>
    </div>
  );
}
