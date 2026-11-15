'use client';
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/client';
type Progress = {
  changed: boolean;
  remaining: number;
  error: string | null;
  retry: { id: string; action: 'delete' | 'reprocess' } | null;
};
export function FileOperations() {
  const client = useQueryClient();
  const forceMaintenance = useRef(false);
  const [error, setError] = useState('');
  const [retryTarget, setRetryTarget] = useState<Progress['retry']>(null);
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    try {
      if (retryTarget)
        await api('/api/files', {
          operation: 'bulk',
          ids: [retryTarget.id],
          action: retryTarget.action,
        });
      if (!retryTarget) forceMaintenance.current = true;
      window.dispatchEvent(new Event('vault-operations'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Retry failed.');
    } finally {
      setRetrying(false);
    }
  }
  useEffect(() => {
    let stopped = false;
    let running = false;
    let requested = false;
    let idleDelay = 15000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (delay: number) => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void advance(), delay);
    };
    async function advance() {
      if (stopped || document.visibilityState !== 'visible') return;
      if (running) {
        requested = true;
        return;
      }
      running = true;
      let delay = 15000;
      try {
        const maintenance = forceMaintenance.current;
        forceMaintenance.current = false;
        const result = await api<Progress>('/api/operations', { maintenance });
        if (stopped) return;
        setError(result.error || '');
        setRetryTarget(result.retry);
        if (result.changed) {
          await Promise.all(
            [
              'files',
              'file-details',
              'pdf',
              'analytics',
              'shares',
              'activity',
            ].map((key) => client.invalidateQueries({ queryKey: [key] })),
          );
        }
        idleDelay =
          result.remaining || result.changed
            ? 15000
            : Math.min(idleDelay * 2, 120000);
        delay = result.remaining ? (result.changed ? 700 : 5000) : idleDelay;
      } catch (cause) {
        if (!stopped)
          setError(
            cause instanceof Error
              ? cause.message
              : 'File preparation or cleanup could not continue. Try again.',
          );
      } finally {
        running = false;
        if (!stopped) {
          if (requested) {
            requested = false;
            delay = 0;
          }
          schedule(delay);
        }
      }
    }
    const resume = () => {
      if (document.visibilityState === 'visible') {
        idleDelay = 15000;
        if (running) requested = true;
        else schedule(0);
      }
    };
    window.addEventListener('vault-operations', resume);
    document.addEventListener('visibilitychange', resume);
    schedule(0);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('vault-operations', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [client]);
  if (!error) return null;
  return (
    <div
      className="notice error"
      role="alert"
      style={{ margin: '16px 24px 0' }}
    >
      {error}
      <button
        type="button"
        className="btn"
        disabled={retrying}
        onClick={() => void retry()}
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  );
}
