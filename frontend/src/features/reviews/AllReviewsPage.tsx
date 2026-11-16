'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Link } from '../../lib/navigation';
import { PageHeader, Card, LoadingState, ErrorState, EmptyState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../../app/AuthContext';

type Review = {
  id: string; student_id: string; student_name: string; grade_class: string; academic_year: string;
  review_type: string; scheduled_date: string; conducted_at?: string; review_notes?: string; status: string;
  approvals: Array<{ id: string; required_role: string; status: string; approver_name?: string; comment?: string }>;
};

export default function AllReviewsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery<Review[]>({ queryKey: ['school-reviews', user?.active_role ?? 'unknown'], queryFn: () => api.get('/reviews') });
  return (
    <>
      <div className="mx-auto max-w-5xl">
        <PageHeader title="IEP Reviews & Approvals" subtitle="Review schedule and approval status across your students" />
        {isLoading && <LoadingState />}
        {error && <ErrorState message="Unable to load school reviews." onRetry={() => queryClient.invalidateQueries({ queryKey: ['school-reviews', user?.active_role ?? 'unknown'] })} />}
        {data && data.length === 0 && <EmptyState title="No reviews scheduled yet" description="Scheduled IEP reviews will appear here across your assigned students." />}
        <div className="space-y-3">
          {data?.map(review => {
            const pending = review.approvals.filter(a => a.status === 'pending').length;
            return <Card key={review.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-charcoal-warm">{review.review_type.replace(/_/g, ' ')} review</p>
                  <Link to={`/students/${review.student_id}/reviews`} className="mt-1 inline-block text-base font-medium text-ink-black underline decoration-ink/30 underline-offset-4 hover:decoration-ink">{review.student_name}</Link>
                  <p className="mt-1 text-xs text-graphite">{review.grade_class} · IEP {review.academic_year} · Scheduled {formatDate(review.scheduled_date)}</p>
                </div>
                <StatusBadge status={review.status} />
              </div>
              {review.review_notes && <p className="mt-3 text-sm text-graphite">{review.review_notes}</p>}
              <div className="mt-4 flex flex-wrap gap-3 border-t border-bone pt-3 text-xs text-graphite">
                <span>{review.approvals.length} approval steps</span>
                <span>{pending} pending</span>
                <Link to={`/students/${review.student_id}/reviews`} className="font-medium text-ink-black underline underline-offset-4">Open review details and decisions</Link>
              </div>
            </Card>;
          })}
        </div>
      </div>
    </>
  );
}
