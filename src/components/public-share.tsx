'use client';
import dynamic from 'next/dynamic';
const ContentPreview = dynamic(
  () =>
    import('@/components/files/content-preview').then(
      (module) => module.ContentPreview,
    ),
  {
    ssr: false,
    loading: () => <div className="skeleton" style={{ height: 300 }} />,
  },
);

import { PasswordInput } from '@/components/ui/password-input';
import { useEffect, useState } from 'react';
import { LockKeyhole, Layers3, Download, FileKey2 } from 'lucide-react';
import { api, bytes } from '@/lib/client';
export function PublicShare({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [file, setFile] = useState<{
    name: string;
    mimeType: string;
    size: number;
    contentUrl: string;
  } | null>(null);
  const [presenceError, setPresenceError] = useState('');
  useEffect(() => {
    if (!file) return;
    const viewerId = crypto.randomUUID();
    let disposed = false;
    async function presence(active: boolean) {
      try {
        const response = await fetch(`/api/public/${token}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ viewerId, active }),
          keepalive: true,
        });
        if (!disposed && [401, 403, 404].includes(response.status)) {
          setFile(null);
          setError(
            'This share or viewing session has ended. Authorize again if the link is still active.',
          );
        } else if (!disposed)
          setPresenceError(
            response.ok ? '' : 'Live viewer status could not refresh.',
          );
      } catch {
        if (!disposed)
          setPresenceError('Live viewer status is temporarily unavailable.');
      }
    }
    const update = () => void presence(document.visibilityState === 'visible');
    update();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void presence(true);
    }, 15000);
    const leave = () => void presence(false);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pagehide', leave);
    return () => {
      disposed = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [file, token]);
  async function open(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      setFile(await api(`/api/public/${token}`, { password }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to open this share.');
    } finally {
      setPending(false);
    }
  }
  return (
    <main style={{ maxWidth: 900, margin: 'auto', padding: '45px 24px' }}>
      <div
        className="brand"
        style={{ justifyContent: 'center', marginBottom: 45 }}
      >
        <Layers3 color="#2563eb" />
        VAULTSPACE
      </div>
      <div className="card" style={{ padding: 30, textAlign: 'center' }}>
        {!file ? (
          <>
            <FileKey2
              size={40}
              color="#2563eb"
              style={{ margin: '0 auto 20px' }}
            />
            <h1>A space shared with you</h1>
            <p className="muted">
              Open the shared file. Enter its password if one was provided.
            </p>
            <form
              onSubmit={open}
              style={{ maxWidth: 340, margin: '25px auto' }}
            >
              <label className="form-field" style={{ textAlign: 'left' }}>
                Share password (if required)
                <PasswordInput
                  placeholder="Enter the share password, if required"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {error && (
                <p className="notice error" role="alert">
                  {error}
                </p>
              )}
              <button className="btn primary" disabled={pending}>
                <LockKeyhole size={15} />
                {pending ? 'Authorizing…' : 'Open shared file'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1>{file.name}</h1>
            {presenceError && (
              <p className="notice" role="status">
                {presenceError}
              </p>
            )}
            <p className="muted">
              {bytes(file.size)} · Access stays active while you view this page
            </p>
            <ContentPreview
              url={file.contentUrl}
              name={file.name}
              mimeType={file.mimeType}
              size={file.size}
            />
            <p style={{ marginTop: 20 }}>
              <a className="btn" href={file.contentUrl} download={file.name}>
                <Download size={16} />
                Download original
              </a>
            </p>
          </>
        )}
      </div>
      <p
        className="muted"
        style={{
          textAlign: 'center',
          fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
          marginTop: 25,
        }}
      >
        Private sharing · Access can be revoked by the owner at any time
      </p>
    </main>
  );
}
