'use client';
import { useDateFormatter } from '@/hooks/use-date-formatter';

import { TypographySettings } from '@/components/ui/typography-settings';
import { PasswordInput } from '@/components/ui/password-input';
import { PreferenceCards } from '@/components/ui/preference-cards';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  UserRound,
  Palette,
  HardDrive,
  ShieldCheck,
  LogOut,
  Check,
} from 'lucide-react';
import { api, bytes } from '@/lib/client';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { Dialog } from '@/components/ui/dialog';
type Preferences = {
  maxUploadBytes: number | null;
  storageQuotaBytes: number | null;
  warningBytes: number | null;
  trashRetentionDays: number | null;
};
type SettingsResponse = {
  settings: Preferences;
  uploadLimit: number;
  user: { name: string; email: string };
};
type Session = {
  id: string;
  token: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
};
export function Settings() {
  const { data, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<SettingsResponse>('/api/settings'),
  });
  return error ? (
    <div className="notice error">{error.message}</div>
  ) : data ? (
    <SettingsForm data={data} />
  ) : (
    <div className="skeleton" style={{ height: 400 }} />
  );
}
function SettingsForm({ data }: { data: SettingsResponse }) {
  const date = useDateFormatter();
  const router = useRouter();
  const params = useSearchParams();
  const section = ['account', 'appearance', 'storage', 'security'].includes(
    params.get('section') ?? '',
  )
    ? params.get('section')!
    : 'account';
  const sections = [
    {
      id: 'account',
      label: 'Account',
      icon: UserRound,
      description: 'The person behind the vault.',
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: Palette,
      description: 'Make this space feel like yours.',
    },
    {
      id: 'storage',
      label: 'Storage',
      icon: HardDrive,
      description: 'Set boundaries that work for you.',
    },
    {
      id: 'security',
      label: 'Security',
      icon: ShieldCheck,
      description: 'Keep your private space protected.',
    },
  ];
  function changeSection(value: string) {
    router.replace('/settings?section=' + value, { scroll: false });
  }

  const client = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [view, setView] = useLocalPreference('vault-view', 'grid');
  const [density, setDensity] = useLocalPreference(
    'vault-density',
    'comfortable',
  );
  const [concurrency, setConcurrency] = useLocalPreference(
    'vault-upload-concurrency',
    '3',
  );
  const [retentionConfirmation, setRetentionConfirmation] =
    useState<Preferences | null>(null);
  const [prefs, setPrefs] = useState<Preferences>(
    data.settings ?? {
      maxUploadBytes: null,
      storageQuotaBytes: null,
      warningBytes: null,
      trashRetentionDays: null,
    },
  );
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState(data.user.name);
  const [sessions, setSessions] = useState<Session[] | null>(null);
  async function run(task: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
      setMessage(success);
      void Promise.all(
        ['settings', 'analytics', 'upload-policy'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  }
  function mb(
    field: 'maxUploadBytes' | 'storageQuotaBytes' | 'warningBytes',
    label: string,
  ) {
    return storageInput(field, label);
  }
  function savePreferences() {
    const base = data.settings ?? prefs;
    const next: Preferences = {
      ...base,
      maxUploadBytes: prefs.maxUploadBytes,
      storageQuotaBytes: prefs.storageQuotaBytes,
      warningBytes: prefs.warningBytes,
      trashRetentionDays: prefs.trashRetentionDays,
    };
    if (
      next.trashRetentionDays !== null &&
      next.trashRetentionDays !== base.trashRetentionDays
    ) {
      setRetentionConfirmation(next);
      return;
    }
    void run(() => api('/api/settings', next), 'Storage policies saved.');
  }
  function storageInput(
    field: 'maxUploadBytes' | 'storageQuotaBytes' | 'warningBytes',
    label: string,
  ) {
    return (
      <label className="form-field">
        {label}
        <Input
          type="number"
          min="1"
          placeholder="Not configured"
          value={prefs[field] ? prefs[field]! / 1048576 : ''}
          onChange={(e) =>
            setPrefs({
              ...prefs,
              [field]: e.target.value
                ? Math.round(Number(e.target.value) * 1048576)
                : null,
            })
          }
        />
      </label>
    );
  }
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div
          className="notice"
          role="status"
          style={{
            background: '#ecfdf5',
            color: '#047857',
            borderColor: '#a7f3d0',
          }}
        >
          <Check size={14} style={{ display: 'inline', marginRight: 6 }} />
          {message}
        </div>
      )}
      <div
        className="settings-navigation"
        role="tablist"
        aria-label="Settings sections"
      >
        {sections.map((item, index) => (
          <button
            type="button"
            role="tab"
            key={item.id}
            id={`settings-tab-${item.id}`}
            aria-selected={section === item.id}
            aria-controls="settings-panel"
            tabIndex={section === item.id ? 0 : -1}
            onClick={() => changeSection(item.id)}
            onKeyDown={(event) => {
              let next = index;
              if (event.key === 'ArrowRight')
                next = (index + 1) % sections.length;
              else if (event.key === 'ArrowLeft')
                next = (index - 1 + sections.length) % sections.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = sections.length - 1;
              else return;
              event.preventDefault();
              changeSection(sections[next].id);
              document
                .getElementById(`settings-tab-${sections[next].id}`)
                ?.focus();
            }}
          >
            <item.icon size={16} />
            {item.label}
          </button>
        ))}
      </div>
      <div className="settings-section-intro">
        <h2>{sections.find((item) => item.id === section)?.label}</h2>
        <p>{sections.find((item) => item.id === section)?.description}</p>
      </div>
      <div
        className="settings-grid"
        id="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${section}`}
      >
        <section
          className="card settings-section"
          data-settings-section="account"
          hidden={section !== 'account'}
        >
          <h2 style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <UserRound size={18} color="#2563eb" />
            Profile details
          </h2>
          <p>Your vault has a single owner. Public registration is disabled.</p>
          <label className="form-field">
            Email address
            <Input
              placeholder="you@example.com"
              readOnly
              value={data.user.email}
            />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () => api('/api/auth/update-user', { name }),
                'Profile updated.',
              );
            }}
          >
            <label className="form-field">
              Display name
              <Input
                placeholder="Enter your name"
                required
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="btn" disabled={busy}>
              Update profile
            </button>
          </form>
        </section>
        <section
          className="card settings-section"
          data-settings-section="appearance"
          hidden={section !== 'appearance'}
        >
          <h2 style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <Palette size={18} color="#8b5cf6" />
            Display preferences
          </h2>
          <p>Appearance preferences are saved on this browser.</p>
          <div className="preference-group">
            <h3>Color theme</h3>
            <PreferenceCards
              kind="theme"
              value={theme ?? 'light'}
              onChange={setTheme}
            />
          </div>
          <TypographySettings />
          <div className="preference-group">
            <h3>Default file view</h3>
            <PreferenceCards kind="view" value={view} onChange={setView} />
          </div>
          <div className="preference-group">
            <h3>Content density</h3>
            <PreferenceCards
              kind="density"
              value={density}
              onChange={setDensity}
            />
            <p className="density-feedback" role="status">
              {density === 'compact'
                ? 'Compact layout is active. Cards, lists, folders, and panels use less spacing.'
                : 'Comfortable layout is active. Cards, lists, folders, and panels have more breathing room.'}{' '}
              Saved automatically on this device.
            </p>
          </div>
        </section>
        <section
          className="card settings-section"
          data-settings-section="storage"
          hidden={section !== 'storage'}
        >
          <h2 style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <HardDrive size={18} color="#10b981" />
            Storage policies
          </h2>
          <p>
            Server upload ceiling: {bytes(data.uploadLimit)}. Leave quota blank
            for no owner-configured quota. Quotas include trashed originals and
            pending transfers.
          </p>
          <label className="form-field">
            Concurrent upload parts
            <Select
              value={concurrency}
              onChange={(e) => setConcurrency(e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <p className="preference-device-note">
            Upload concurrency is saved on this device and applies to new
            transfers.
          </p>
          {mb('maxUploadBytes', 'Maximum upload size (MB)')}
          {mb('storageQuotaBytes', 'Optional total storage quota (MB)')}
          {mb('warningBytes', 'Storage warning threshold (MB)')}
          <label className="form-field">
            Automatic trash retention (days)
            <Input
              type="number"
              min="1"
              max="3650"
              placeholder="Manual deletion only (default)"
              value={prefs.trashRetentionDays ?? ''}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  trashRetentionDays: e.target.value
                    ? Number(e.target.value)
                    : null,
                })
              }
            />
          </label>
          <p>
            Setting a retention period enables automatic permanent deletion of
            older trashed files while the app is open.
          </p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => savePreferences()}
          >
            Save policies
          </button>
        </section>
        <section
          className="card settings-section"
          data-settings-section="security"
          hidden={section !== 'security'}
        >
          <h2 style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <ShieldCheck size={18} color="#2563eb" />
            Password
          </h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                () =>
                  api('/api/auth/change-password', {
                    currentPassword,
                    newPassword,
                    revokeOtherSessions: true,
                  }),
                'Password updated. Other sessions were revoked.',
              );
            }}
          >
            <label className="form-field">
              Current password
              <PasswordInput
                placeholder="Enter your current password"
                required

                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="form-field">
              New password
              <PasswordInput
                placeholder="Choose a new password (8+ characters)"
                required

                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button className="btn" disabled={busy}>
              Change password
            </button>
          </form>
        </section>
        <section
          className="card settings-section"
          data-settings-section="security"
          hidden={section !== 'security'}
        >
          <h2 style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
            <LogOut size={18} color="#64748b" />
            Active sessions
          </h2>
          <p>
            Review devices with access to your vault and revoke individual
            sessions.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              void run(
                async () =>
                  setSessions(await api<Session[]>('/api/auth/list-sessions')),
                'Sessions refreshed.',
              )
            }
          >
            Load active sessions
          </button>
          {sessions?.map((s) => (
            <div
              key={s.id}
              style={{
                padding: '14px 0',
                fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div style={{ overflowWrap: 'anywhere' }}>
                {s.userAgent ?? 'Unknown browser'}
              </div>
              <p>
                Created {date(s.createdAt)} · Expires {date(s.expiresAt)}
              </p>
              <button
                className="btn danger"
                style={{
                  fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
                  padding: '6px 10px',
                }}
                disabled={busy}
                onClick={() =>
                  void run(
                    () => api('/api/auth/revoke-session', { token: s.token }),
                    'Session revoked. Refresh the session list to review access.',
                  )
                }
              >
                Revoke session
              </button>
            </div>
          ))}
        </section>
      </div>
      <Dialog
        open={Boolean(retentionConfirmation)}
        onOpenChange={(open) => {
          if (!open && !busy) setRetentionConfirmation(null);
        }}
        title="Enable automatic permanent deletion?"
        description={`Trashed files older than ${retentionConfirmation?.trashRetentionDays ?? 0} days will be permanently removed while the app is open. This cannot be undone.`}
      >
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button
            className="btn"
            disabled={busy}
            onClick={() => setRetentionConfirmation(null)}
          >
            Cancel
          </button>
          <button
            className="btn danger"
            disabled={busy}
            onClick={() => {
              if (retentionConfirmation)
                void run(async () => {
                  await api('/api/settings', retentionConfirmation);
                  setRetentionConfirmation(null);
                }, 'Automatic retention policy saved.');
            }}
          >
            Enable policy
          </button>
        </div>
      </Dialog>
    </>
  );
}
