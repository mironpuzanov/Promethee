import React, { useState, useEffect } from 'react';

interface OnboardingScreenProps {
  onAuthenticated: (user: any) => void;
}

type Step = 'restore-session' | 'signin' | 'signup' | 'magic-link' | 'check-email' | 'check-confirm' | 'setting-up';

const dragBar = (
  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 48, WebkitAppRegion: 'drag' as any }} />
);

const base: React.CSSProperties = {
  height: '100dvh' as any,
  display: 'flex',
  background: 'var(--background)',
  color: 'var(--foreground)',
  colorScheme: 'dark' as any,
  fontFamily: 'Geist, -apple-system, sans-serif',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--input)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '11px 14px',
  color: 'var(--foreground)',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box' as any,
  fontFamily: 'inherit',
};

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'var(--primary-foreground)',
  border: 'none',
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
  fontFamily: 'inherit',
};

const btnLink: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-fire)',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
  fontFamily: 'inherit',
  textDecoration: 'underline',
  textDecorationColor: 'transparent',
};

function Err({ msg }: { msg: string }) {
  return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--destructive)', fontSize: 13, padding: '10px 14px', borderRadius: 10 }}>
      {msg}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={base}>
      {dragBar}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 48px' }}>
        <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {children}
        </div>
      </div>
      <div style={{ width: 380, background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '64px 40px', gap: 16 }}>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>What builders say</p>
        {[
          { name: 'Thomas R.', handle: '@thomasbuilds', text: 'I went from 2h of deep work a day to 6h. The accountability layer is everything.' },
          { name: 'Clara M.', handle: '@claradesigns', text: "Three months in and I've shipped more than the previous year. The XP system keeps me honest." },
          { name: 'Lucas B.', handle: '@lucasdev', text: "La Guilde changed my relationship with work. I'm finally consistent." },
        ].map(t => (
          <div key={t.handle} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>"{t.text}"</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {t.name.charAt(0)}
              </div>
              <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: 500 }}>{t.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.handle}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingScreen({ onAuthenticated }: OnboardingScreenProps) {
  const [step, setStep] = useState<Step>('signup');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check for stored session flag — if present, show restore step instead of signup
    if ((window.promethee as any).onboarding?.hasStoredSession) {
      (window.promethee as any).onboarding.hasStoredSession().then((has: boolean) => {
        if (has) setStep('restore-session');
      }).catch(() => {});
    }

    const remove = window.promethee.auth.onAuthError((message: string) => {
      setStep('signin');
      setError(message || 'Link expired. Try again.');
    });
    return () => remove();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try { await fn(); }
    catch (e: any) { setError(e?.message || 'Something went wrong.'); }
    finally { setLoading(false); }
  };

  const go = (s: Step) => { setStep(s); setError(null); };

  // ── Restore session (returning user) ─────────────────────────────────────
  if (step === 'restore-session') {
    const handleRestore = () => {
      run(async () => {
        const r = await (window.promethee as any).onboarding.restoreSession();
        if (r.success && r.user) {
          onAuthenticated(r.user);
        } else {
          // Stale flag — nothing in keychain, fall through to sign in
          setStep('signin');
        }
      });
    };

    return (
      <Shell>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Promethee</div>
          <h1 style={{ fontSize: 30, fontWeight: 300, margin: 0, letterSpacing: '-0.03em' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>
            Your session is saved. Tap below to pick up where you left off.
          </p>
        </div>

        {error && <Err msg={error} />}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleRestore}
            disabled={loading}
            style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Restoring…' : 'Continue'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Not you?{' '}
            <button onClick={() => go('signin')} style={btnLink}>Sign in with a different account</button>
          </p>
        </div>
      </Shell>
    );
  }

  // ── Sign in ──────────────────────────────────────────────────────────────
  if (step === 'signin') {
    const handle = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const em = (fd.get('email') as string)?.trim();
      const pw = fd.get('password') as string;
      if (!em || !pw) return;
      run(async () => {
        const r = await window.promethee.auth.signIn(em, pw);
        if (!r.success) setError(r.error || 'Invalid email or password.');
        // on success main process opens dashboard
      });
    };

    return (
      <Shell>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Promethee</div>
          <h1 style={{ fontSize: 30, fontWeight: 300, margin: 0, letterSpacing: '-0.03em' }}>Welcome back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>Sign in to your account.</p>
        </div>

        {error && <Err msg={error} />}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input name="email" type="email" placeholder="Email address" required style={inputStyle} autoFocus />
          <input name="password" type="password" placeholder="Password" required style={inputStyle} />
          <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Forgot password or signed up with magic link?{' '}
            <button onClick={() => go('magic-link')} style={btnLink}>Send magic link</button>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            No account?{' '}
            <button onClick={() => go('signup')} style={btnLink}>Create one</button>
          </p>
        </div>
      </Shell>
    );
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  if (step === 'magic-link') {
    const handle = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const em = (fd.get('email') as string)?.trim();
      if (!em) return;
      run(async () => {
        const r = await window.promethee.auth.sendMagicLink(em);
        if (r.success) { setEmail(em); setStep('check-email'); }
        else setError(r.error || 'Failed to send link.');
      });
    };

    return (
      <Shell>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 300, margin: 0, letterSpacing: '-0.03em' }}>Magic link</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>We'll email you a one-click sign-in link.</p>
        </div>

        {error && <Err msg={error} />}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input name="email" type="email" placeholder="Email address" required style={inputStyle} autoFocus />
          <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          <button onClick={() => go('signin')} style={btnLink}>Back to sign in</button>
        </p>
      </Shell>
    );
  }

  // ── Sign up ───────────────────────────────────────────────────────────────
  if (step === 'signup') {
    const handle = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const em = (fd.get('email') as string)?.trim();
      const pw = fd.get('password') as string;
      const cf = fd.get('confirm') as string;
      if (!em || !pw) return;
      if (pw !== cf) { setError('Passwords do not match.'); return; }
      if (pw.length < 6) { setError('Password must be at least 6 characters.'); return; }
      run(async () => {
        const r = await window.promethee.auth.signUp(em, pw);
        if (!r.success) setError(r.error || 'Failed to create account.');
        else if (r.needsConfirmation) { setEmail(em); setStep('check-confirm'); }
        else {
          // Auto-confirmed — main process is opening the dashboard.
          // Show a transitional screen so it doesn't look frozen.
          setStep('setting-up');
        }
      });
    };

    return (
      <Shell>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Promethee</div>
          <h1 style={{ fontSize: 30, fontWeight: 300, margin: 0, letterSpacing: '-0.03em' }}>Get started</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '8px 0 0' }}>Create your account and start building seriously.</p>
        </div>

        {error && <Err msg={error} />}

        <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input name="email" type="email" placeholder="Email address" required style={inputStyle} autoFocus />
          <input name="password" type="password" placeholder="Password (min 6 characters)" required style={inputStyle} />
          <input name="confirm" type="password" placeholder="Confirm password" required style={inputStyle} />
          <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: 4, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Already have an account?{' '}
            <button onClick={() => go('signin')} style={btnLink}>Sign in</button>
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            Signed up with magic link?{' '}
            <button onClick={() => go('magic-link')} style={btnLink}>Send magic link</button>
          </p>
        </div>
      </Shell>
    );
  }

  // ── Setting up (auto-confirmed signup) ───────────────────────────────────
  if (step === 'setting-up') {
    return (
      <div style={{ ...base, alignItems: 'center', justifyContent: 'center' }}>
        {dragBar}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', maxWidth: 320, padding: '0 32px', alignItems: 'center' }}>
          <div style={{ fontSize: 40 }}>🚀</div>
          <h2 style={{ fontSize: 24, fontWeight: 300, margin: 0, letterSpacing: '-0.02em' }}>Setting up your account</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            You're in. Opening your dashboard now…
          </p>
        </div>
      </div>
    );
  }

  // ── Check email (magic link sent) ─────────────────────────────────────────
  if (step === 'check-email' || step === 'check-confirm') {
    const isConfirm = step === 'check-confirm';
    return (
      <div style={{ ...base, alignItems: 'center', justifyContent: 'center' }}>
        {dragBar}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, textAlign: 'center', maxWidth: 380, padding: '0 32px' }}>
          <div style={{ fontSize: 44 }}>✉️</div>
          <h2 style={{ fontSize: 24, fontWeight: 300, margin: 0, letterSpacing: '-0.02em' }}>
            {isConfirm ? 'Confirm your email' : 'Check your email'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {isConfirm
              ? <>Confirmation link sent to <strong style={{ color: 'var(--foreground)' }}>{email}</strong>. Click it, then come back and sign in.</>
              : <>Magic link sent to <strong style={{ color: 'var(--foreground)' }}>{email}</strong>. Click it to sign in — you can close this window.</>
            }
          </p>
          <button onClick={() => go('signin')} style={{ ...btnLink, fontSize: 14 }}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return null;
}
