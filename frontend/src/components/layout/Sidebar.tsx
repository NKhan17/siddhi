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
        : 'hidden h-screen w-[76px] shrink-0 flex-col border-r border-ink/15 bg-warm-parchment md:sticky md:top-0 md:flex'}
      aria-label="Main navigation"
    >
      <div className="flex h-[72px] items-center justify-center border-b border-ink/15">
        {mobile ? (
          <div className="flex w-full items-center justify-between px-5">
            <span className="font-display text-[26px] leading-none tracking-tight text-ink">Siddhi</span>
            <button onClick={onClose} className="rounded-full border border-ink/20 p-2 text-graphite hover:bg-soft-linen" aria-label="Close navigation"><X size={18} /></button>
          </div>
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ink text-[17px] font-semibold tracking-tight text-ink" aria-label="Siddhi">S</span>
        )}
      </div>
      <nav className={mobile ? 'flex flex-1 flex-col gap-2 px-4 py-6' : 'flex flex-1 flex-col items-center gap-3 px-3 py-6'} aria-label="Sidebar navigation">
        {navItems.map((item) => (
          <NavLink
            key={`${item.label}-${item.to}`}
            to={item.to}
            onClick={onNavigate}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) => mobile
              ? `flex items-center gap-3 rounded-full px-4 py-3 text-sm transition-colors ${isActive ? 'bg-ink text-white' : 'text-graphite hover:bg-soft-linen'}`
              : `group relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${isActive ? 'border-ink bg-ink text-white' : 'border-transparent text-graphite hover:border-pale-stone hover:bg-gallery-white'}`}
          >
            {item.icon}
            {mobile && <span>{item.label}</span>}
            {!mobile && <span className="pointer-events-none absolute left-[calc(100%+12px)] z-30 hidden whitespace-nowrap rounded-full border border-ink/15 bg-gallery-white px-3 py-1.5 text-xs text-ink group-hover:block">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={mobile ? 'border-t border-ink/15 px-4 py-5 text-xs text-graphite' : 'border-t border-ink/15 py-4 text-center text-[10px] tracking-[0.18em] text-graphite'}>
        {mobile ? 'SIDDHI · IEP WORKSPACE' : 'IEP'}
      </div>
    </aside>
  );
}
