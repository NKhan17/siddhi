'use client';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../../lib/navigation';
import { api } from '../../lib/api';
import type { GuardianProfile } from '../../types';
import { PageShell } from '../../components/layout/PageShell';
import { LoadingState, ErrorState, Avatar, EmptyState } from '../../components/ui';
import { Mail, Phone, ChevronRight } from 'lucide-react';
import { ageFromDob } from '../../lib/utils';

export default function GuardianProfilePage() {
  const navigate = useNavigate();
  const { data: profile, isLoading, error, refetch } = useQuery<GuardianProfile>({
    queryKey: ['guardian-profile'],
    queryFn: () => api.get('/guardians/me/profile'),
  });

  return (
    <PageShell>
      <div className="space-y-8">
        <section className="rounded-lg border border-ink/80 bg-gallery-white p-6 sm:p-9 lg:p-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-signal-orange">Account</p>
          <h1 className="mt-3 font-display text-[44px] leading-[1.02] text-ink sm:text-[58px]">Guardian</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">Your contact details and the children linked to your account.</p>
          {isLoading && <LoadingState message="Loading your profile…" />}
          {error && <div className="mt-6"><ErrorState message="Unable to load your profile." onRetry={() => refetch()} /></div>}
          {profile && (
            <div className="mt-8 flex flex-col gap-5 border-t border-dashed border-ink/40 pt-6 sm:flex-row sm:items-center">
              <Avatar name={profile.full_name} size="xl" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[30px] text-ink sm:text-[36px]">{profile.full_name}</h2>
                <div className="mt-3 flex flex-col gap-2 text-sm text-graphite sm:flex-row sm:flex-wrap sm:gap-x-6">
                  {profile.email && <span className="flex items-center gap-2"><Mail size={15} />{profile.email}</span>}
                  {profile.phone && <span className="flex items-center gap-2"><Phone size={15} />{profile.phone}</span>}
                </div>
              </div>
            </div>
          )}
        </section>

        {profile && (
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-graphite">Family</p><h2 className="mt-1 font-display text-[32px] text-ink">Linked children</h2></div>
              <span className="rounded-full border border-pale-stone bg-gallery-white px-3 py-1.5 text-xs text-graphite">{profile.children.length} {profile.children.length === 1 ? 'child' : 'children'}</span>
            </div>
            {profile.children.length === 0 ? (
              <div className="rounded-lg border border-ink/70 bg-gallery-white"><EmptyState title="No children linked" description="Contact the school administration to link your children." /></div>
            ) : (
              <div className="space-y-3">
                {profile.children.map((child) => (
                  <button key={child.student_id} onClick={() => navigate(`/students/${child.student_id}`)} className="group flex w-full items-center gap-4 rounded-lg border border-ink/80 bg-gallery-white p-4 text-left transition-colors hover:border-signal-orange sm:p-5" aria-label={`Open ${child.full_name}'s profile`}>
                    <Avatar name={child.full_name} imageUrl={child.profile_image_path} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{child.full_name}</p>
                      <p className="mt-1 truncate text-xs text-graphite">{child.grade_class} <span className="px-1 text-ash-gray">·</span> {ageFromDob(child.date_of_birth)} years <span className="px-1 text-ash-gray">·</span> {child.relationship_label || 'Guardian'}</p>
                    </div>
                    <span className="hidden items-center gap-2 text-xs text-graphite sm:flex">View profile <ChevronRight size={15} className="transition-transform group-hover:translate-x-1" /></span>
                    <ChevronRight size={18} className="text-graphite sm:hidden" />
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </PageShell>
  );
}
