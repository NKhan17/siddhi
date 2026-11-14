'use client';

import type { ReactNode } from 'react';
import { PageShell } from '../../components/layout/PageShell';
import { Avatar, Card } from '../../components/ui';
import { useAuth } from '../../app/AuthContext';
import { Mail, Phone, BadgeCheck, Building2, UserRound } from 'lucide-react';

function prettyRole(role: string) { return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

function Detail({ label, value, icon }: { label: string; value?: string | null; icon: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-ink/10 py-4 last:border-0">
      <span className="mt-0.5 rounded-full bg-soft-linen p-2 text-graphite">{icon}</span>
      <div className="min-w-0"><p className="text-[11px] uppercase tracking-[0.14em] text-graphite">{label}</p><p className="mt-1 break-words text-sm font-medium text-ink">{value || 'Not provided'}</p></div>
    </div>
  );
}

export default function StaffProfilePage() {
  const { user } = useAuth();
  if (!user) return null;

  const memberships = user.memberships.filter((membership) => membership.school_id === user.active_school_id);
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl space-y-7">
        <div><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-signal-orange">Account</p><h1 className="mt-2 font-display text-[44px] leading-none text-ink sm:text-[58px]">My profile</h1><p className="mt-3 text-sm text-graphite">Your account information and current workspace details.</p></div>
        <Card className="!border-ink/80 !p-6 sm:!p-9">
          <div className="flex flex-col gap-5 border-b border-dashed border-ink/40 pb-7 sm:flex-row sm:items-center">
            <Avatar name={user.full_name} size="xl" />
            <div><h2 className="font-display text-[32px] leading-tight text-ink sm:text-[40px]">{user.full_name}</h2><p className="mt-2 text-xs capitalize text-graphite">{user.active_role.replace(/_/g, ' ')}</p></div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-x-10 md:grid-cols-2">
            <Detail label="Email address" value={user.email} icon={<Mail size={17} />} />
            <Detail label="Phone number" value={user.phone} icon={<Phone size={17} />} />
            <Detail label="Faculty ID" value={user.faculty_id} icon={<BadgeCheck size={17} />} />
            <Detail label="Active role" value={prettyRole(user.active_role)} icon={<UserRound size={17} />} />
          </div>
        </Card>
        <Card className="!border-ink/80 !p-6 sm:!p-8">
          <div className="mb-4 flex items-center gap-3"><span className="rounded-full bg-soft-linen p-2 text-graphite"><Building2 size={18} /></span><div><h2 className="font-display text-[27px] text-ink">Workspace</h2><p className="text-xs text-graphite">Your active school access</p></div></div>
          {memberships.length > 0 ? memberships.map((membership) => (
            <div key={`${membership.school_id}-${membership.role}`} className="flex flex-col gap-1 border-t border-ink/10 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-ink">{membership.school_name}</p>
              <span className="text-xs capitalize text-graphite">{prettyRole(membership.role)}</span>
            </div>
          )) : <p className="text-sm text-graphite">No school membership details available.</p>}
        </Card>
      </div>
    </PageShell>
  );
}
