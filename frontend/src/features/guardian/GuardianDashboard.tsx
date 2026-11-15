'use client';

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../../lib/navigation';
import { api } from '../../lib/api';
import type { GuardianChildCard } from '../../types';
import { PageShell } from '../../components/layout/PageShell';
import { LoadingState, ErrorState, EmptyState, Avatar, StatusBadge } from '../../components/ui';
import { ageFromDob } from '../../lib/utils';
import { ArrowUpRight, ChevronRight, GraduationCap, Heart, ShieldCheck } from 'lucide-react';

function ChildFacts({ child }: { child: GuardianChildCard }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-soft-linen p-2 text-graphite"><GraduationCap size={17} strokeWidth={1.7} /></span>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-graphite">Class</p><p className="mt-1 text-sm font-medium text-ink">{child.grade_class || 'Not recorded'}</p></div>
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-soft-linen p-2 text-graphite"><Heart size={17} strokeWidth={1.7} /></span>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-graphite">Support area</p><p className="mt-1 text-sm font-medium text-ink">{child.disability_category || 'Not recorded'}</p></div>
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-soft-linen p-2 text-graphite"><ShieldCheck size={17} strokeWidth={1.7} /></span>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-graphite">IEP status</p><div className="mt-1">{child.active_iep_status ? <StatusBadge status={child.active_iep_status} /> : <span className="text-sm text-graphite">No active plan</span>}</div></div>
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 rounded-full bg-soft-linen p-2 text-graphite"><UserRoundIcon /></span>
        <div><p className="text-[11px] uppercase tracking-[0.14em] text-graphite">Relationship</p><p className="mt-1 text-sm font-medium text-ink">{child.relationship_label || 'Guardian'}</p></div>
      </div>
      {child.academic_year && <div className="sm:col-span-2"><p className="text-xs text-graphite">Academic year · <span className="font-medium text-ink">{child.academic_year}</span></p></div>}
    </div>
  );
}

function UserRoundIcon() {
  return <span className="block text-[13px] font-medium leading-[17px]">Me</span>;
}

function ChildCard({ child, featured = false }: { child: GuardianChildCard; featured?: boolean }) {
  const navigate = useNavigate();
  const age = ageFromDob(child.date_of_birth);
  const open = () => navigate(`/students/${child.student_id}`);

  if (featured) {
    return (
      <button onClick={open} className="group w-full rounded-lg border border-ink/80 bg-gallery-white p-6 text-left transition-colors hover:border-signal-orange focus-visible:outline-none sm:p-8 lg:p-10" aria-label={`Open ${child.full_name}'s profile`}>
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(230px,0.78fr)_1.22fr] lg:gap-10">
          <div className="flex min-w-0 flex-col items-center text-center lg:items-start lg:text-left">
            <Avatar name={child.full_name} imageUrl={child.profile_image_path} size="2xl" />
            <div className="mt-5 min-w-0">
              <p className="font-display text-[32px] leading-tight text-ink sm:text-[40px]">{child.full_name}</p>
              <p className="mt-2 text-sm text-graphite">{age} years old <span className="px-1.5 text-muted-text">·</span> {child.grade_class || 'Class not recorded'}</p>
              <p className="mt-1 text-xs text-graphite">{child.relationship_label || 'Your child'}</p>
            </div>
            <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink px-5 py-2.5 text-xs font-medium text-ink transition-colors group-hover:border-signal-orange group-hover:bg-signal-orange group-hover:text-white">
              View child profile <ArrowUpRight size={15} />
            </span>
          </div>
          <div className="border-t border-dashed border-ink/50 pt-7 lg:min-h-[250px] lg:border-l lg:border-t-0 lg:pl-9 lg:pt-0 lg:flex lg:items-center">
            <div className="w-full"><ChildFacts child={child} /></div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button onClick={open} className="group flex min-h-[470px] w-full flex-col items-center rounded-lg border border-ink/80 bg-gallery-white p-7 text-center transition-colors hover:border-signal-orange focus-visible:outline-none sm:p-8" aria-label={`Open ${child.full_name}'s profile`}>
      <Avatar name={child.full_name} imageUrl={child.profile_image_path} size="2xl" />
      <p className="mt-6 font-display text-[30px] leading-tight text-ink">{child.full_name}</p>
      <p className="mt-2 text-sm text-graphite">{age} years old <span className="px-1.5 text-muted-text">·</span> {child.grade_class || 'Class not recorded'}</p>
      <p className="mt-1 text-xs text-graphite">{child.relationship_label || 'Your child'}</p>
      <div className="mt-8 w-full border-t border-dashed border-ink/50 pt-6 text-left"><ChildFacts child={child} /></div>
      <span className="mt-auto inline-flex items-center gap-2 pt-7 text-xs font-medium text-ink transition-colors group-hover:text-charcoal-warm">View child profile <ChevronRight size={15} /></span>
    </button>
  );
}

export default function GuardianDashboard() {
  const { data: children, isLoading, error, refetch } = useQuery<GuardianChildCard[]>({
    queryKey: ['guardian-children'],
    queryFn: () => api.get('/guardians/me/children'),
  });

  return (
    <PageShell>
      <section className="mb-8 flex flex-col gap-3 sm:mb-10">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-charcoal-warm">Family workspace</p>
        <h1 className="font-display text-[42px] leading-[1.02] text-ink sm:text-[54px]">Your child{children && children.length > 1 ? 'ren' : ''}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-graphite sm:text-base">Choose a child to open their learning and support profile.</p>
      </section>

      {isLoading && <LoadingState message="Loading linked children…" />}
      {error && <ErrorState message="Unable to load your children's information." onRetry={() => refetch()} />}
      {!isLoading && !error && children && (
        <>
          {children.length === 0 && <div className="rounded-lg border border-ink/70 bg-gallery-white"><EmptyState title="No children linked yet" description="Contact your school administration to link your account to your child's profile." /></div>}
          {children.length === 1 && <ChildCard child={children[0]} featured />}
          {children.length >= 2 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {children.map((child) => <ChildCard key={child.student_id} child={child} />)}
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
