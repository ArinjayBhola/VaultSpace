'use client';

import { PasswordInput } from '@/components/ui/password-input';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShieldCheck, ArrowRight, LockKeyhole, Layers3 } from 'lucide-react';
const schema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Enter your password.'),
});
export function Login({ configured }: { configured: boolean }) {
  const router = useRouter();
  const client = useQueryClient();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  async function submit(values: z.infer<typeof schema>) {
    setError('');
    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.message ?? 'Unable to sign in. Check your credentials.',
        );
      }
      client.clear();
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in.');
    }
  }
  return (
    <main className="login">
      <section className="login-intro">
        <div className="brand" style={{ padding: 0 }}>
          <Layers3 color="#60a5fa" /> VAULTSPACE
        </div>
        <div>
          <div
            className="badge"
            style={{
              background: '#203354',
              color: '#a9c9ff',
              marginBottom: 27,
            }}
          >
            <ShieldCheck size={13} /> YOUR PRIVATE CLOUD
          </div>
          <h1>
            Everything worth keeping.
            <br />
            <span style={{ color: '#83adf9' }}>One private space.</span>
          </h1>
          <p>
            Your documents, your memories, your ideas. Securely stored,
            thoughtfully organized, and always within reach.
          </p>
        </div>
        <span
          style={{
            color: '#94a3b8',
            fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
          }}
        >
          Private by design. Yours by default.
        </span>
      </section>
      <section className="login-form">
        <div>
          <LockKeyhole size={30} color="#2563eb" style={{ marginBottom: 25 }} />
          <h1 style={{ marginBottom: 10 }}>Welcome back</h1>
          <p className="muted" style={{ marginBottom: 30 }}>
            Sign in to your personal vault.
          </p>
          {!configured && (
            <div className="notice">
              <strong>Your vault needs configuration.</strong>
              <br />
              Configure Neon and authentication in <code>.env.local</code>,
              apply migrations, then run <code>npm run owner:provision</code>.
              Public registration is disabled.
            </div>
          )}
          <form onSubmit={handleSubmit(submit)}>
            <label className="form-field">
              Email address
              <Input
                autoComplete="username"
                type="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && (
                <span className="danger">{errors.email.message}</span>
              )}
            </label>
            <label className="form-field">
              Password
              <PasswordInput
                autoComplete="current-password"

                placeholder="Enter your password"
                {...register('password')}
              />
              {errors.password && (
                <span className="danger">{errors.password.message}</span>
              )}
            </label>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <Button
              disabled={!configured || isSubmitting}
              className="btn primary"
              style={{ width: '100%', marginTop: 12, padding: 13 }}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in to your vault'}
              <ArrowRight size={16} />
            </Button>
          </form>
          <p
            className="muted"
            style={{
              fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
              textAlign: 'center',
              marginTop: 26,
            }}
          >
            <ShieldCheck
              size={12}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: 5,
              }}
            />{' '}
            Private access · Single owner · Secure sessions
          </p>
        </div>
      </section>
    </main>
  );
}
