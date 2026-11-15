'use client';

import React, { useEffect, useState } from 'react';
import { Menu, LogOut, ChevronDown, ArrowLeft, Download } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../app/AuthContext';
import { api } from '../../lib/api';
import { Sidebar } from './Sidebar';
import { initials } from '../../lib/utils';

interface PageShellProps { children: React.ReactNode }
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

const sectionNames: Array<[RegExp, string]> = [
  [/^\/guardian$/, 'Family overview'], [/^\/profile$/, 'My profile'], [/^\/guardian\/profile$/, 'My profile'],
  [/^\/staff$/, 'Dashboard'], [/^\/students$/, 'Students'], [/^\/attendance$/, 'School attendance'], [/^\/reviews$/, 'IEP reviews'], [/^\/students\/[^/]+$/, 'Student profile'], [/^\/reports$/, 'Reports'],
  [/\/plop$/, 'Present level of performance'], [/\/iep$/, 'IEP plan'], [/\/progress$/, 'Progress'],
  [/\/therapy$/, 'Therapy'], [/\/accommodations$/, 'Accommodations'], [/\/communications$/, 'Communications'],
  [/\/assessments$/, 'Assessments'], [/\/attendance$/, 'Attendance'], [/\/reviews$/, 'Reviews'], [/\/edit$/, 'Edit student'],
];

export function PageShell({ children }: PageShellProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const pageTitle = sectionNames.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Workspace';

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = !!target && (target.isContentEditable || ['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
      const candidates = Array.from(document.querySelectorAll<HTMLInputElement>('[data-app-search-input]:not([disabled])'));
      const visible = candidates.filter(input => input.getClientRects().length > 0);
      const searchInput = visible.find(input => input.closest('[role="dialog"]')) ?? visible[0];
      const isFind = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f';
      const isQuickSearch = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !isEditing;
      if ((isFind || isQuickSearch) && searchInput) {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    };
    window.addEventListener('keydown', handleShortcut, true);
    return () => window.removeEventListener('keydown', handleShortcut, true);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    window.history.pushState({ ...(window.history.state ?? {}), __siddhiMobileNavigation: true }, '', window.location.href);
    const handleBack = () => setMobileOpen(false);
    window.addEventListener('popstate', handleBack);
    return () => window.removeEventListener('popstate', handleBack);
  }, [mobileOpen]);

  const closeMobileNavigation = () => {
    if (window.history.state?.__siddhiMobileNavigation) window.history.back();
    else setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-warm-parchment text-ink">
      <Sidebar />
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button className="absolute inset-0 bg-ink/35" onClick={closeMobileNavigation} aria-label="Close navigation overlay" />
          <div id="mobile-main-navigation" className="relative z-10 h-full"><Sidebar mobile onNavigate={closeMobileNavigation} onClose={closeMobileNavigation} /></div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between gap-3 border-b border-ink/15 bg-warm-parchment/95 px-4 backdrop-blur-sm sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => {
                const fallback = pathname.startsWith('/students/') ? `/students/${pathname.split('/')[2]}` : user?.active_role === 'guardian' ? '/guardian' : '/staff';
                if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
                else router.push(fallback);
              }}
              className="rounded-full border border-ink/20 p-2 text-ink transition-colors hover:bg-gallery-white"
              aria-label="Go back"
              title="Go back"
            ><ArrowLeft size={17} /></button>
            <button onClick={() => setMobileOpen(true)} aria-expanded={mobileOpen} aria-controls="mobile-main-navigation" className="rounded-full border border-ink/20 p-2 text-ink hover:bg-gallery-white md:hidden" aria-label="Open navigation"><Menu size={18} /></button>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-graphite">Siddhi workspace</p>
              <p className="truncate text-sm font-medium text-ink">{pageTitle}</p>
            </div>
          </div>
          {user && (
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              {installPrompt && <button onClick={async () => { const prompt = installPrompt; setInstallPrompt(null); await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome !== 'accepted') setInstallPrompt(prompt); }} className="hidden items-center gap-2 rounded-full border border-ink/20 bg-gallery-white px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-soft-linen sm:flex" title="Install Siddhi as an app"><Download size={14} /> Install app</button>}
              {user.roles.length > 1 && (
                <label className="hidden items-center gap-2 rounded-full border border-ink/20 bg-gallery-white px-3 py-2 text-xs text-graphite sm:flex">
                  <span className="hidden md:inline">Workspace</span>
                  <select
                    aria-label="Switch workspace role"
                    value={user.active_role}
                    onChange={async (event) => {
                      await api.post('/auth/select-role', { role: event.target.value, school_id: user.active_school_id });
                      window.location.reload();
                    }}
                    className="max-w-[150px] appearance-none bg-transparent pr-4 text-xs font-medium capitalize text-ink outline-none"
                  >
                    {user.roles.map((role) => <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>)}
                  </select>
                  <ChevronDown size={13} />
                </label>
              )}
              <button onClick={() => router.push('/profile')} className="flex items-center gap-2 rounded-full p-1.5 pr-2 text-left transition-colors hover:bg-gallery-white" aria-label="Open my profile">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ink/20 bg-soft-linen text-xs font-medium text-ink">{initials(user.full_name)}</span>
                <span className="hidden max-w-[155px] sm:block">
                  <span className="block truncate text-xs font-medium text-ink">{user.full_name}</span>
                  <span className="block truncate text-[11px] capitalize text-graphite">{user.active_role.replace(/_/g, ' ')}</span>
                </span>
              </button>
              <button onClick={() => logout()} title="Sign out" aria-label="Sign out" className="rounded-full border border-ink/20 p-2 text-graphite transition-colors hover:bg-gallery-white hover:text-ink"><LogOut size={17} /></button>
            </div>
          )}
        </header>
        <main className="w-full flex-1 px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
