'use client';

import React from 'react';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

type NavigationDirection = 'forward' | 'back';
type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => { finished: Promise<void> } };

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

export function useNavigate() {
  const router = useRouter();
  return React.useCallback((path: string, options?: { replace?: boolean; direction?: NavigationDirection }) => {
    withViewTransition(() => options?.replace ? router.replace(path) : router.push(path), options?.direction ?? 'forward');
  }, [router]);
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

export function Link({ to, children, ...props }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string; children: React.ReactNode }) {
  const router = useRouter();
  return <NextLink href={to} {...props} onNavigate={(event) => {
    event.preventDefault();
    withViewTransition(() => router.push(to), 'forward');
  }}>{children}</NextLink>;
}

export function NavLink({ to, children, className, ...props }: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'> & { to: string; children: React.ReactNode; className?: string | ((state: { isActive: boolean }) => string) }) {
  const pathname = usePathname();
  const router = useRouter();
  // Guardian profile is exposed at /guardian/profile but shares the /profile nav item.
  const activePath = pathname === '/guardian/profile' ? '/profile' : pathname;
  const isActive = activePath === to || (to !== '/' && activePath.startsWith(`${to}/`));
  const resolved = typeof className === 'function' ? className({ isActive }) : className;
  return <NextLink href={to} className={resolved} aria-current={isActive ? 'page' : undefined} {...props} onNavigate={(event) => {
    event.preventDefault();
    withViewTransition(() => router.push(to), 'forward');
  }}>{children}</NextLink>;
}

export function Navigate({ to, replace = false }: { to: string; replace?: boolean; state?: unknown }) {
  const router = useRouter();
  React.useEffect(() => { withViewTransition(() => replace ? router.replace(to) : router.push(to), 'forward'); }, [router, to, replace]);
  return null;
}
