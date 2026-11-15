'use client';

import type { ReactNode } from 'react';
import {
  Users, Calendar,
  ClipboardCheck, BarChart2, UserRound,
  X, LayoutDashboard,
} from 'lucide-react';
import { NavLink } from '../../lib/navigation';
import { useAuth } from '../../app/AuthContext';
import type { Role } from '../../types';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

function getNavItems(role: Role): NavItem[] {
  const profile: NavItem = { label: 'My profile', to: '/profile', icon: <UserRound size={20} strokeWidth={1.7} /> };
  const dashboard: NavItem = { label: 'Dashboard', to: role === 'guardian' ? '/guardian' : '/staff', icon: <LayoutDashboard size={20} strokeWidth={1.7} /> };
  let items: NavItem[];

  switch (role) {
    case 'guardian':
      items = [dashboard, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'special_educator':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'Attendance', to: '/attendance', icon: <Calendar size={20} strokeWidth={1.7} /> }, { label: 'Reviews', to: '/reviews', icon: <ClipboardCheck size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'therapist':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'psychiatrist':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'psychologist':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'school_head':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'IEP reviews', to: '/reviews', icon: <ClipboardCheck size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    case 'school_admin':
      items = [dashboard, { label: 'Students', to: '/students', icon: <Users size={20} strokeWidth={1.7} /> }, { label: 'Reports', to: '/reports', icon: <BarChart2 size={20} strokeWidth={1.7} /> }];
      break;
    default:
      items = [dashboard];
  }

  return [...items, profile];
}

interface SidebarProps {
  mobile?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}

export function Sidebar({ mobile = false, onNavigate, onClose }: SidebarProps) {
  const { user } = useAuth();
  if (!user) return null;

  const navItems = getNavItems(user.active_role);
  return (
    <aside
      className={mobile
        ? 'flex h-full w-[min(290px,86vw)] flex-col border-r border-ink/15 bg-warm-parchment'
        : 'hidden h-screen w-[76px] shrink-0 flex-col border-r border-ink/15 bg-warm-parchment md:sticky md:top-0 md:flex xl:w-[280px]'}
      aria-label="Main navigation"
    >
      <div className={`flex h-[72px] shrink-0 items-center border-b border-ink/15 ${mobile ? 'justify-between px-5' : 'justify-center xl:justify-start xl:px-5'}`}>
        {mobile ? (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink text-[17px] font-semibold tracking-tight text-ink">S</span>
              <span className="min-w-0"><span className="block font-display text-xl leading-none tracking-tight text-ink">Siddhi</span><span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-graphite">IEP workspace</span></span>
            </div>
            <button onClick={onClose} className="rounded-full border border-ink/20 p-2 text-graphite hover:bg-soft-linen" aria-label="Close navigation"><X size={18} /></button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink text-[17px] font-semibold tracking-tight text-ink" aria-label="Siddhi">S</span>
            <span className="hidden min-w-0 xl:block"><span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-graphite">Siddhi</span><span className="block text-sm font-medium text-ink">Workspace</span></span>
          </div>
        )}
      </div>
      <nav className={mobile ? 'flex flex-1 flex-col gap-2 px-4 py-6' : 'flex flex-1 flex-col items-center gap-3 overflow-y-auto px-3 py-6 xl:items-stretch xl:px-4'} aria-label="Sidebar navigation">
        {navItems.map((item) => (
          <NavLink
            key={`${item.label}-${item.to}`}
            to={item.to}
            onClick={onNavigate}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) => mobile
              ? `flex min-h-11 w-full min-w-0 items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${isActive ? 'bg-ink text-white' : 'text-graphite hover:bg-soft-linen'}`
              : `group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors xl:h-11 xl:w-full xl:min-w-0 xl:justify-start xl:gap-3 xl:px-4 ${isActive ? 'border-ink bg-ink text-white' : 'border-transparent text-graphite hover:border-pale-stone hover:bg-gallery-white'}`}
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">{item.icon}</span>
            <span className={mobile ? 'block min-w-0 flex-1 whitespace-nowrap' : 'hidden min-w-0 flex-1 whitespace-nowrap xl:block'}>{item.label}</span>
            {!mobile && <span className="pointer-events-none absolute left-[calc(100%+12px)] z-30 hidden whitespace-nowrap rounded-lg border border-ink/15 bg-gallery-white px-3 py-1.5 text-xs text-ink group-hover:block xl:hidden">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={mobile ? 'border-t border-ink/15 px-4 py-5 text-xs text-graphite' : 'border-t border-ink/15 py-4 text-center text-[10px] tracking-[0.18em] text-graphite xl:text-left xl:px-6'}>
        {mobile ? 'SIDDHI · IEP WORKSPACE' : <><span className="xl:hidden">IEP</span><span className="hidden xl:inline">INDIVIDUALIZED EDUCATION</span></>}
      </div>
    </aside>
  );
}
