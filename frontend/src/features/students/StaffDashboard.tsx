import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '../../lib/navigation';
import { api } from '../../lib/api';
import type { ReportsSummary } from '../../types';
import { useAuth } from '../../app/AuthContext';
import { PageShell } from '../../components/layout/PageShell';
import { Card, LoadingState, ErrorState, StatusBadge } from '../../components/ui';
import { Users, BookOpen, TrendingUp, ClipboardCheck } from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery<ReportsSummary>({
    queryKey: ['reports-summary'],
    queryFn: () => api.get('/reports/summary'),
  });

  if (!user) return null;

  const roleName = user.active_role.replace(/_/g, ' ');
  const greeting = `Welcome, ${user.full_name.split(' ')[0]}`;
  const showClassOverview = ['school_admin', 'school_head'].includes(user.active_role);
  const classes = Object.values((data?.students ?? []).reduce<Record<string, { grade_class: string; count: number }>>((acc, student) => {
    const key = student.grade_class || 'Unassigned';
    acc[key] ??= { grade_class: key, count: 0 };
    acc[key].count += 1;
    return acc;
  }, {})).sort((a, b) => a.grade_class.localeCompare(b.grade_class, undefined, { numeric: true }));

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-ink-black tracking-tight">{greeting}</h1>
          <p className="text-sm text-slate-gray capitalize">{roleName} · Dashboard</p>
        </div>

        {isLoading && <LoadingState />}
        {error && <ErrorState message="Unable to load dashboard data." />}

        {data && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users size={18} className="text-burnt-amber" aria-hidden="true" />
                  <span className="text-xs text-slate-gray uppercase tracking-wide">Students</span>
                </div>
                <p className="text-2xl font-medium text-ink-black">{data.total_students}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen size={18} className="text-deep-violet" aria-hidden="true" />
                  <span className="text-xs text-slate-gray uppercase tracking-wide">Active IEPs</span>
                </div>
                <p className="text-2xl font-medium text-ink-black">{data.active_plans}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp size={18} className="text-slate-gray" aria-hidden="true" />
                  <span className="text-xs text-slate-gray uppercase tracking-wide">Total Goals</span>
                </div>
                <p className="text-2xl font-medium text-ink-black">{data.total_goals}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <ClipboardCheck size={18} className="text-graphite" aria-hidden="true" />
                  <span className="text-xs text-slate-gray uppercase tracking-wide">Achieved</span>
                </div>
                <p className="text-2xl font-medium text-ink-black">{data.achieved_goals}</p>
              </Card>
            </div>

            {showClassOverview ? (
              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div><h2 className="text-base font-medium text-ink-black">Classes</h2><p className="text-sm text-slate-gray">Select a class to view its students.</p></div>
                  <span className="text-xs text-graphite">{classes.length} classes</span>
                </div>
                {classes.length === 0 ? <p className="text-sm text-graphite">No active students registered yet.</p> : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {classes.map((item) => (
                      <button key={item.grade_class} onClick={() => navigate(`/students?grade_class=${encodeURIComponent(item.grade_class)}`)} className="flex items-center justify-between gap-3 rounded-lg border border-ink/15 bg-gallery-white p-4 text-left transition-colors hover:border-signal-orange">
                        <span className="min-w-0"><span className="block text-sm font-medium text-ink">{item.grade_class}</span><span className="mt-1 block text-xs text-graphite">{item.count} {item.count === 1 ? 'student' : 'students'}</span></span>
                        <span className="text-sm text-graphite" aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section>
                <h2 className="text-base font-medium text-ink-black mb-3">{data.students.length > 0 ? 'Students assigned to you' : 'Assigned students'}</h2>
                {data.students.length === 0 ? <p className="text-sm text-graphite">No students are currently assigned to you.</p> : (
                  <div className="space-y-2">
                    {data.students.slice(0, 10).map((s) => (
                      <button key={s.student_id} onClick={() => navigate(`/students/${s.student_id}`)} className="flex w-full items-center gap-4 rounded-lg border border-ink/15 bg-gallery-white p-4 text-left transition-colors hover:border-signal-orange">
                        <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{s.full_name}</p><p className="text-xs text-graphite">{s.grade_class} · {s.disability_category}</p></div>
                        <div className="hidden items-center gap-3 text-xs text-graphite sm:flex">{s.academic_year && <span>{s.academic_year}</span>}{s.goal_attainment_pct != null && <span>{s.goal_attainment_pct}% attainment</span>}</div>
                        {s.active_iep && <StatusBadge status="active" />}
                      </button>
                    ))}
                    {data.students.length > 10 && <button onClick={() => navigate('/students')} className="w-full py-2 text-center text-xs text-ink hover:underline">View all {data.students.length} students →</button>}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
