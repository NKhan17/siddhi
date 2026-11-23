'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { navigateTo } from './lib/navigation';
import { AuthProvider, useAuth } from './app/AuthContext';
import { ProtectedRoute } from './app/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import { PageShell } from './components/layout/PageShell';

function RouteChunkLoading() {
  return <div className="flex min-h-[35vh] items-center justify-center text-sm text-graphite" role="status" aria-live="polite">Loading workspace…</div>;
}

// Keep the initial workspace bundle small. Feature modules are loaded only when
// their route is opened (and are warmed by prefetchNavigation on hover/touch).
const StudentDashboard = dynamic(() => import('./features/student/StudentDashboard'), { loading: RouteChunkLoading });
const GuardianDashboard = dynamic(() => import('./features/guardian/GuardianDashboard'), { loading: RouteChunkLoading });
const ProfilePage = dynamic(() => import('./features/profile/ProfilePage'), { loading: RouteChunkLoading });
const StaffDashboard = dynamic(() => import('./features/students/StaffDashboard'), { loading: RouteChunkLoading });
const StudentsListPage = dynamic(() => import('./features/students/StudentsListPage'), { loading: RouteChunkLoading });
const StudentProfilePage = dynamic(() => import('./features/students/StudentProfilePage'), { loading: RouteChunkLoading });
const StudentEditPage = dynamic(() => import('./features/students/StudentEditPage'), { loading: RouteChunkLoading });
const PLOPPage = dynamic(() => import('./features/plop/PLOPPage'), { loading: RouteChunkLoading });
const IEPPage = dynamic(() => import('./features/iep/IEPPage'), { loading: RouteChunkLoading });
const ProgressPage = dynamic(() => import('./features/progress/ProgressPage'), { loading: RouteChunkLoading });
const TherapyPage = dynamic(() => import('./features/therapy/TherapyPage'), { loading: RouteChunkLoading });
const AccommodationsPage = dynamic(() => import('./features/accommodations/AccommodationsPage'), { loading: RouteChunkLoading });
const CommunicationsPage = dynamic(() => import('./features/communications/CommunicationsPage'), { loading: RouteChunkLoading });
const AssessmentsPage = dynamic(() => import('./features/assessments/AssessmentsPage'), { loading: RouteChunkLoading });
const AttendancePage = dynamic(() => import('./features/attendance/AttendancePage'), { loading: RouteChunkLoading });
const AllAttendancePage = dynamic(() => import('./features/attendance/AllAttendancePage'), { loading: RouteChunkLoading });
const ReviewsPage = dynamic(() => import('./features/reviews/ReviewsPage'), { loading: RouteChunkLoading });
const AllReviewsPage = dynamic(() => import('./features/reviews/AllReviewsPage'), { loading: RouteChunkLoading });
const ReportsPage = dynamic(() => import('./features/reports/ReportsPage'), { loading: RouteChunkLoading });

function RouteContent() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const studentRoute = pathname.match(/^\/students\/([^/]+)(?:\/(plop|iep|progress|therapy|accommodations|communications|assessments|attendance|reviews|edit))?$/);
  const studentId = studentRoute?.[1];
  const section = studentRoute?.[2];

  useEffect(() => {
    if (isLoading) return;
    if (pathname === '/' && !user) navigateTo('/login', { replace: true, transition: false });
    else if (pathname === '/' && user) navigateTo(user.landing_route, { replace: true, transition: false });
    else if (!['/login','/forgot-password','/reset-password'].includes(pathname) && !user) navigateTo('/login', { replace: true, transition: false });
  }, [pathname, user, isLoading]);

  if (isLoading && pathname !== '/login') return <RouteChunkLoading />;
  if (pathname === '/login') return <LoginPage />;
  if (pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (pathname === '/reset-password') return <ResetPasswordPage />;
  if (!user) return null;
  if (pathname === '/student') return <ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>;
  if (pathname === '/guardian') return <ProtectedRoute allowedRoles={['guardian']}><GuardianDashboard /></ProtectedRoute>;
  if (pathname === '/profile' || pathname === '/guardian/profile') return <ProtectedRoute allowedRoles={['guardian','special_educator','therapist','psychologist','psychiatrist','school_head','school_admin']}><ProfilePage /></ProtectedRoute>;
  if (pathname === '/reports') return <ProtectedRoute allowedRoles={['guardian','special_educator','therapist','psychologist','psychiatrist','school_head','school_admin']}><ReportsPage /></ProtectedRoute>;
  if (pathname === '/staff') return <ProtectedRoute allowedRoles={['special_educator','therapist','psychologist','psychiatrist','school_head','school_admin']}><StaffDashboard /></ProtectedRoute>;
  if (pathname === '/attendance') return <ProtectedRoute allowedRoles={['special_educator','school_head','school_admin']}><AllAttendancePage /></ProtectedRoute>;
  if (pathname === '/reviews') return <ProtectedRoute allowedRoles={['special_educator','school_head','school_admin']}><AllReviewsPage /></ProtectedRoute>;
  if (pathname === '/students') return <ProtectedRoute allowedRoles={['special_educator','therapist','psychologist','psychiatrist','school_head','school_admin']}><StudentsListPage /></ProtectedRoute>;
  if (studentId && !section) return <ProtectedRoute><StudentProfilePage /></ProtectedRoute>;
  if (studentId && section === 'edit') return <ProtectedRoute allowedRoles={['special_educator','school_head','school_admin']}><StudentEditPage /></ProtectedRoute>;
  if (studentId && section === 'plop') return <ProtectedRoute><PLOPPage /></ProtectedRoute>;
  if (studentId && section === 'iep') return <ProtectedRoute><IEPPage /></ProtectedRoute>;
  if (studentId && section === 'progress') return <ProtectedRoute><ProgressPage /></ProtectedRoute>;
  if (studentId && section === 'therapy') return <ProtectedRoute><TherapyPage /></ProtectedRoute>;
  if (studentId && section === 'accommodations') return <ProtectedRoute><AccommodationsPage /></ProtectedRoute>;
  if (studentId && section === 'communications') return <ProtectedRoute><CommunicationsPage /></ProtectedRoute>;
  if (studentId && section === 'assessments') return <ProtectedRoute><AssessmentsPage /></ProtectedRoute>;
  if (studentId && section === 'attendance') return <ProtectedRoute><AttendancePage /></ProtectedRoute>;
  if (studentId && section === 'reviews') return <ProtectedRoute><ReviewsPage /></ProtectedRoute>;
  return <div className="py-12"><h1 className="font-display text-4xl">Page not found</h1><button className="mt-4 rounded-full border border-ink px-5 py-2 text-sm hover:bg-gallery-white" onClick={() => navigateTo(user.landing_route)}>Return to dashboard</button></div>;
}

function AppFrame() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublicRoute = ['/login', '/forgot-password', '/reset-password'].includes(pathname);
  if (isLoading || !user || isPublicRoute) return <RouteContent />;
  return <PageShell><RouteContent /></PageShell>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><Suspense fallback={<div className="min-h-screen" />}><AppFrame /></Suspense></AuthProvider></QueryClientProvider>;
}
