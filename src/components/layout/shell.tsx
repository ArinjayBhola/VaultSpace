'use client';

import { FileOperations } from '@/components/files/operations';
import { Tooltip } from '@/components/ui/tooltip';
import { useEffect, useRef, useState } from 'react';
import { GlobalSearch } from '@/components/search/global-search';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  FolderClosed,
  Clock3,
  Activity,
  Star,
  Files,
  Link2,
  Trash2,
  BarChart3,
  Settings2,
  ShieldCheck,
  Menu,
  Sun,
  Moon,
  Monitor,
  Plus,
  ChevronRight,
  LogOut,
  X,
} from 'lucide-react';
import { useUploads } from '@/components/uploads/upload-provider';
import { userTimeZone } from '@/lib/time';
import { api, bytes } from '@/lib/client';
import type { Analytics } from '@/types';
import { useLocalPreference } from '@/hooks/use-local-preference';
const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/files', label: 'My files', icon: FolderClosed },
  { href: '/recent', label: 'Recent', icon: Clock3 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/starred', label: 'Starred', icon: Star },
  { href: '/documents', label: 'Documents', icon: Files },
  { href: '/collections', label: 'Collections', icon: Layers3 },
  { href: '/shared', label: 'Shared links', icon: Link2 },
  { href: '/trash', label: 'Trash', icon: Trash2 },
];
export function Shell({
  children,
}: {
  children: React.ReactNode;
  user: { name: string; email: string };
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [density] = useLocalPreference('vault-density', 'comfortable');
  const [sidebarMode, setSidebarMode] = useLocalPreference(
    'vault-sidebar',
    'expanded',
  );
  const collapsed = sidebarMode === 'collapsed';
  const { pick } = useUploads();
  const [mobile, setMobile] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        navigation.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobile(false);
      }
      if (event.key === 'Tab') {
        const targets = focusable();
        const first = targets[0];
        const last = targets.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [mobile]);
  const [logoutError, setLogoutError] = useState('');
  const { data } = useQuery({
    queryKey: ['analytics', userTimeZone()],
    queryFn: () =>
      api<Analytics>(
        '/api/analytics?timezone=' + encodeURIComponent(userTimeZone()),
      ),
    refetchInterval: 30000,
  });
  async function logout() {
    try {
      await api('/api/auth/sign-out', {});
      queryClient.clear();
      router.push('/login');
      router.refresh();
    } catch (e) {
      setLogoutError(e instanceof Error ? e.message : 'Logout failed.');
    }
  }
  return (
    <div
      className="shell"
      data-density={density}
      data-sidebar={collapsed ? 'collapsed' : 'expanded'}
    >
      <a href="#workspace" className="visually-hidden">
        Skip to workspace
      </a>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="dialog-overlay"
          style={{ border: 0, zIndex: 85 }}
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        id="vault-sidebar"
        ref={navigation}
        className={`sidebar ${mobile ? 'open' : ''}`}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label="Vault navigation"
      >
        <Tooltip label="Vaultspace overview">
          <Link
            className="brand"
            href="/"
            aria-label="Vaultspace overview"

            onClick={() => setMobile(false)}
          >
            <Layers3 className="brand-symbol" strokeWidth={2.2} />
            <span className="sidebar-label">VAULTSPACE</span>
          </Link>
        </Tooltip>
        <Tooltip label="New upload">
          <button
            className="btn primary sidebar-upload"
            aria-label="New upload"

            style={{
              margin: '31px 10px 0',
              padding: '12px',
              boxShadow: '0 3px 8px #2563eb20',
            }}
            onClick={() =>
              pick(
                pathname.startsWith('/folders/')
                  ? pathname.split('/')[2]
                  : null,
              )
            }
          >
            <Plus size={18} />
            <span className="sidebar-label">New upload</span>
          </button>
        </Tooltip>
        {mobile && (
          <Tooltip label="Close navigation">
            <button
              className="icon-btn mobile-nav-close"
              aria-label="Close navigation"
              onClick={() => setMobile(false)}
            >
              <X size={18} />
            </button>
          </Tooltip>
        )}
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {links.map(({ href, label, icon: Icon }) => (
            <Tooltip key={href} label={label}>
              <Link
                key={href}
                href={href}
                aria-label={label}

                className={`nav-link ${pathname === href || (href === '/files' && pathname.startsWith('/folders/')) ? 'active' : ''}`}
                onClick={() => setMobile(false)}
                aria-current={
                  pathname === href ||
                  (href === '/files' && pathname.startsWith('/folders/'))
                    ? 'page'
                    : undefined
                }
              >
                <Icon size={17} />
                <span className="sidebar-label">{label}</span>
                {href === '/files' && data && (
                  <span
                    className="sidebar-count"
                    style={{
                      marginLeft: 'auto',
                      fontSize:
                        'max(9px, calc(12px * var(--vault-font-scale, 1)))',
                      color: 'var(--muted)',
                    }}
                  >
                    {data.totalFiles}
                  </span>
                )}
              </Link>
            </Tooltip>
          ))}
        </nav>
        <div className="nav-label">MANAGE</div>
        <nav aria-label="Management navigation">
          <Tooltip label="Storage analytics">
            <Link
              href="/analytics"
              aria-label="Storage analytics"

              onClick={() => setMobile(false)}
              className={`nav-link ${pathname === '/analytics' ? 'active' : ''}`}
            >
              <BarChart3 size={17} />
              <span className="sidebar-label">Storage analytics</span>
            </Link>
          </Tooltip>
          <Tooltip label="Settings">
            <Link
              href="/settings"
              aria-label="Settings"

              onClick={() => setMobile(false)}
              className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
            >
              <Settings2 size={17} />
              <span className="sidebar-label">Settings</span>
            </Link>
          </Tooltip>
        </nav>
        <div className="storage-footer">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'max(9px, calc(13.5px * var(--vault-font-scale, 1)))',
              marginBottom: 12,
            }}
          >
            <ShieldCheck size={16} color="#2563eb" />
            Your private space
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 4,
              background: 'var(--border)',
              marginBottom: 10,
            }}
          />
          <span
            className="muted"
            style={{
              fontSize: 'max(9px, calc(13px * var(--vault-font-scale, 1)))',
            }}
          >
            {data
              ? `${bytes(data.activeBytes)} in active files`
              : 'Storage is calculated from your files'}
          </span>
          <Link
            href="/analytics"
            className="link"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 12,
            }}
          >
            Manage storage
            <ChevronRight size={12} />
          </Link>
          <div className="theme-switch" aria-label="Color theme">
            <Tooltip label="Light theme">
              <button
                className="icon-btn"
                aria-label="Light theme"
                onClick={() => setTheme('light')}
              >
                <Sun size={15} />
              </button>
            </Tooltip>
            <Tooltip label="Dark theme">
              <button
                className="icon-btn"
                aria-label="Dark theme"
                onClick={() => setTheme('dark')}
              >
                <Moon size={15} />
              </button>
            </Tooltip>
            <Tooltip label="System theme">
              <button
                className="icon-btn"
                aria-label="System theme"
                onClick={() => setTheme('system')}
              >
                <Monitor size={15} />
              </button>
            </Tooltip>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <Tooltip label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <button
              type="button"
              className="icon-btn desktop-sidebar-toggle"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}

              aria-expanded={!collapsed}
              aria-controls="vault-sidebar"
              onClick={() =>
                setSidebarMode(collapsed ? 'expanded' : 'collapsed')
              }
            >
              {collapsed ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
          </Tooltip>
          <Tooltip label="Open navigation">
            <button
              className="icon-btn mobile-only"
              aria-label="Open navigation"
              aria-expanded={mobile}
              aria-controls="vault-sidebar"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
          </Tooltip>
          <GlobalSearch />
          <div className="topbar-actions">
            <span className="badge" style={{ whiteSpace: 'nowrap' }}>
              <ShieldCheck size={12} />
              PRIVATE VAULT
            </span>
            <Tooltip label="Sign out">
              <button
                className="icon-btn"
                aria-label="Sign out"
                onClick={() => void logout()}
              >
                <LogOut size={16} />
              </button>
            </Tooltip>
          </div>
        </header>
        <FileOperations />
        {data?.warningReached && (
          <div className="notice" style={{ margin: '16px 24px 0' }}>
            Tracked originals and previews exceed your configured storage
            warning threshold.{' '}
            <Link href="/analytics" className="link">
              Review storage
            </Link>
          </div>
        )}
        {logoutError && (
          <div role="alert" className="notice error">
            {logoutError}
            <Tooltip label="Dismiss">
              <button
                className="icon-btn"
                aria-label="Dismiss"
                onClick={() => setLogoutError('')}
              >
                <X size={14} />
              </button>
            </Tooltip>
          </div>
        )}
        <main className="content" id="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}
