'use client';

import React from 'react';
import { usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { queryClient } from './query-client';
import { api } from './api';
import type { Role } from '../types';
import { useAuth } from '../app/AuthContext';

type NavigationDirection = 'forward' | 'back';
type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

function resolveInternalPath(path: string) {
  const url = new URL(path, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Update only the URL/history entry. Next.js patches the native History API and
 * synchronizes usePathname/useSearchParams without requesting a new document or
 * an RSC page payload. The mounted AppFrame and its chrome remain untouched.
 */
export function navigateTo(path: string, options?: { replace?: boolean; direction?: NavigationDirection; transition?: boolean }) {
  if (typeof window === 'undefined') return;
  const destination = resolveInternalPath(path);
  if (!destination) {
    window.location.assign(path);
    return;
  }
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === destination) return;

  const update = () => {
    if (options?.replace) window.history.replaceState(null, '', destination);
    else window.history.pushState(null, '', destination);
  };

  if (options?.transition === false) {
    update();
    return;
  }
  withViewTransition(update, options?.direction ?? 'forward');
}

export function withViewTransition(update: () => void, direction: NavigationDirection = 'forward') {
  if (typeof document === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }

  const root = document.documentElement;
  const viewDocument = document as ViewTransitionDocument;
  root.dataset.navigationDirection = direction;
  if (!viewDocument.startViewTransition) {
    update();
    delete root.dataset.navigationDirection;
    return;
  }

  try {
    const transition = viewDocument.startViewTransition(update);
    const clearDirection = () => {
      if (root.dataset.navigationDirection === direction) delete root.dataset.navigationDirection;
    };
    void transition.finished.then(clearDirection, clearDirection);
  } catch {
    update();
    delete root.dataset.navigationDirection;
  }
}

const featurePreloaders: Record<string, () => Promise<unknown>> = {
  '/staff': () => import('../features/students/StaffDashboard'),
  '/guardian': () => import('../features/guardian/GuardianDashboard'),
  '/students': () => import('../features/students/StudentsListPage'),
  '/reports': () => import('../features/reports/ReportsPage'),
  '/attendance': () => import('../features/attendance/AllAttendancePage'),
  '/reviews': () => import('../features/reviews/AllReviewsPage'),
  '/profile': () => import('../features/profile/ProfilePage'),
};

export function preloadNavigationChunk(path: string) {
  const destination = new URL(path, typeof window === 'undefined' ? 'https://siddhi.invalid' : window.location.href).pathname;
  const chunk = featurePreloaders[destination];
  if (chunk) void chunk().catch(() => undefined);
  const match = destination.match(/^\/students\/[^/]+(?:\/(plop|iep|progress|therapy|accommodations|communications|assessments|attendance|reviews|edit))?$/);
  if (match) void studentFeaturePreloaders[match[1] ?? 'profile']?.().catch(() => undefined);
}

const studentFeaturePreloaders: Record<string, () => Promise<unknown>> = {
  profile: () => import('../features/students/StudentProfilePage'),
  plop: () => import('../features/plop/PLOPPage'),
  iep: () => import('../features/iep/IEPPage'),
  progress: () => import('../features/progress/ProgressPage'),
  therapy: () => import('../features/therapy/TherapyPage'),
  accommodations: () => import('../features/accommodations/AccommodationsPage'),
  communications: () => import('../features/communications/CommunicationsPage'),
  assessments: () => import('../features/assessments/AssessmentsPage'),
  attendance: () => import('../features/attendance/AttendancePage'),
  reviews: () => import('../features/reviews/ReviewsPage'),
  edit: () => import('../features/students/StudentEditPage'),
};

/** Warm the JS chunk and data query while a user points at a destination. */
export function prefetchNavigation(path: string, role?: Role | null) {
  if (typeof window === 'undefined') return;
  const url = new URL(path, window.location.href);
  const destination = url.pathname;
  const chunk = featurePreloaders[destination];
  if (chunk) void chunk().catch(() => undefined);

  const match = destination.match(/^\/students\/([^/]+)(?:\/(plop|iep|progress|therapy|accommodations|communications|assessments|attendance|reviews|edit))?$/);
  if (match) {
    const [, studentId, section] = match;
    const feature = section ?? 'profile';
    void studentFeaturePreloaders[feature]?.().catch(() => undefined);
    if (!section) {
      void queryClient.prefetchQuery({ queryKey: ['student', studentId], queryFn: () => api.get(`/students/${studentId}`) });
    } else {
      const queries: Record<string, () => Promise<unknown>> = {
        plop: () => queryClient.prefetchQuery({ queryKey: ['plop', studentId], queryFn: () => api.get(`/students/${studentId}/plop`) }),
        iep: () => Promise.all([
          queryClient.prefetchQuery({ queryKey: ['iep-plans', studentId], queryFn: () => api.get(`/students/${studentId}/iep-plans`) }),
        ]),
        progress: () => queryClient.prefetchQuery({ queryKey: ['progress', studentId], queryFn: () => api.get(`/students/${studentId}/progress`) }),
        therapy: () => queryClient.prefetchQuery({ queryKey: ['therapy', studentId, ''], queryFn: () => api.get(`/students/${studentId}/therapy-sessions`) }),
        accommodations: () => queryClient.prefetchQuery({ queryKey: ['accommodations', studentId], queryFn: () => api.get(`/students/${studentId}/accommodations`) }),
        communications: () => queryClient.prefetchQuery({ queryKey: ['communications', studentId], queryFn: () => api.get(`/students/${studentId}/parent-interactions`) }),
        assessments: () => queryClient.prefetchQuery({ queryKey: ['assessments', studentId], queryFn: () => api.get(`/students/${studentId}/assessments`) }),
        reviews: () => queryClient.prefetchQuery({ queryKey: ['reviews', studentId], queryFn: () => api.get(`/students/${studentId}/iep-reviews`) }),
      };
      void queries[section]?.().catch(() => undefined);
    }
    return;
  }

  switch (destination) {
    case '/staff':
    case '/reports':
      void queryClient.prefetchQuery({ queryKey: ['reports-summary', role ?? 'unknown'], queryFn: () => api.get('/reports/summary') });
      break;
    case '/guardian':
      void queryClient.prefetchQuery({ queryKey: ['guardian-children'], queryFn: () => api.get('/guardians/me/children') });
      break;
    case '/profile':
      if (role === 'guardian') void queryClient.prefetchQuery({ queryKey: ['guardian-profile'], queryFn: () => api.get('/guardians/me/profile') });
      void import('../features/profile/StaffProfilePage').catch(() => undefined);
      break;
    case '/students':
      void queryClient.prefetchQuery({ queryKey: ['students', '', 1, ''], queryFn: () => api.get('/students', { page: 1, page_size: 20 }) });
      break;
    case '/attendance':
      void queryClient.prefetchQuery({ queryKey: ['school-attendance', role ?? 'unknown', '', ''], queryFn: () => api.get('/attendance') });
      break;
    case '/reviews':
      void queryClient.prefetchQuery({ queryKey: ['school-reviews', role ?? 'unknown'], queryFn: () => api.get('/reviews') });
      break;
  }
}

export function useNavigate() {
  return React.useCallback((path: string, options?: { replace?: boolean; direction?: NavigationDirection }) => {
    navigateTo(path, options);
  }, []);
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>() {
  const pathname = usePathname();
  const match = pathname.match(/^\/students\/([^/]+)/);
  return ({ studentId: match?.[1] } as unknown as T);
}

export function useLocation() {
  return { pathname: usePathname() };
}

export function useSearchParams() {
  const params = useNextSearchParams();
  return [params, (_next: URLSearchParams) => undefined] as const;
}

function isPlainNavigation(event: React.MouseEvent<HTMLAnchorElement>, target?: string, download?: string | boolean) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && (!target || target === '_self') && download === undefined;
}

export function Link({ to, children, onClick, onMouseEnter, onFocus, onTouchStart, target, download, ...props }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; children: React.ReactNode }) {
  const { active_role } = useActiveRole();
  const warm = () => prefetchNavigation(to, active_role);
  return <a href={to} target={target} download={download} {...props}
    onMouseEnter={(event) => { onMouseEnter?.(event); if (!event.defaultPrevented) warm(); }}
    onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) warm(); }}
    onTouchStart={(event) => { onTouchStart?.(event); if (!event.defaultPrevented) warm(); }}
    onClick={(event) => {
      onClick?.(event);
      if (event.defaultPrevented || !isPlainNavigation(event, target, download)) return;
      event.preventDefault();
      navigateTo(to, { direction: 'forward' });
    }}>{children}</a>;
}

export function NavLink({ to, children, className, onClick, onMouseEnter, onFocus, onTouchStart, target, replaceNavigation = false, ...props }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'> & { to: string; children: React.ReactNode; replaceNavigation?: boolean; className?: string | ((state: { isActive: boolean }) => string) }) {
  const pathname = usePathname();
  const { active_role } = useActiveRole();
  // Guardian profile is exposed at /guardian/profile but shares the /profile nav item.
  const activePath = pathname === '/guardian/profile' ? '/profile' : pathname;
  const isActive = activePath === to || (to !== '/' && activePath.startsWith(`${to}/`));
  const resolved = typeof className === 'function' ? className({ isActive }) : className;
  const warm = () => prefetchNavigation(to, active_role);
  return <a href={to} target={target} className={resolved} aria-current={isActive ? 'page' : undefined} {...props}
    onMouseEnter={(event) => { onMouseEnter?.(event); if (!event.defaultPrevented) warm(); }}
    onFocus={(event) => { onFocus?.(event); if (!event.defaultPrevented) warm(); }}
    onTouchStart={(event) => { onTouchStart?.(event); if (!event.defaultPrevented) warm(); }}
    onClick={(event) => {
      onClick?.(event);
      if (event.defaultPrevented || !isPlainNavigation(event, target)) return;
      event.preventDefault();
      navigateTo(to, { direction: 'forward', replace: replaceNavigation });
    }}>{children}</a>;
}

function useActiveRole() {
  const { user } = useAuth();
  return { active_role: user?.active_role ?? null };
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean; state?: unknown }) {
  React.useEffect(() => {
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath !== to) navigateTo(to, { replace, direction: 'forward', transition: false });
  }, [to, replace]);
  return null;
}
