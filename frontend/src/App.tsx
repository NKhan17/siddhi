'use client';

import { Suspense, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './app/AuthContext';
import { ProtectedRoute } from './app/ProtectedRoute';
import { PageShell } from './components/layout/PageShell';
import LoginPage from './features/auth/LoginPage';
import ForgotPasswordPage from './features/auth/ForgotPasswordPage';
import ResetPasswordPage from './features/auth/ResetPasswordPage';
import GuardianDashboard from './features/guardian/GuardianDashboard';
import ProfilePage from './features/profile/ProfilePage';
import StaffDashboard from './features/students/StaffDashboard';
import StudentsListPage from './features/students/StudentsListPage';
import StudentProfilePage from './features/students/StudentProfilePage';
import StudentEditPage from './features/students/StudentEditPage';
import PLOPPage from './features/plop/PLOPPage';
import IEPPage from './features/iep/IEPPage';
import ProgressPage from './features/progress/ProgressPage';
import TherapyPage from './features/therapy/TherapyPage';
import AccommodationsPage from './features/accommodations/AccommodationsPage';
import CommunicationsPage from './features/communications/CommunicationsPage';
import AssessmentsPage from './features/assessments/AssessmentsPage';
import AttendancePage from './features/attendance/AttendancePage';
import ReviewsPage from './features/reviews/ReviewsPage';
import ReportsPage from './features/reports/ReportsPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function RouteContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const studentRoute = pathname.match(/^\/students\/([^/]+)(?:\/(plop|iep|progress|therapy|accommodations|communications|assessments|attendance|reviews|edit))?$/);
  const studentId = studentRoute?.[1];
  const section = studentRoute?.[2];

  useEffect(() => {
    if (isLoading) return;
    if (pathname === '/' && !user) router.replace('/login');
    else if (pathname === '/' && user) router.replace(user.landing_route);
    else if (!['/login','/forgot-password','/reset-password'].includes(pathname) && !user) router.replace('/login');
  }, [pathname, user, isLoading, router]);

  if (isLoading && pathname !== '/login') return <div className="min-h-screen flex items-center justify-center text-slate-gray">Loading…</div>;
  if (pathname === '/login') return <LoginPage />;
  if (pathname === '/forgot-password') return <ForgotPasswordPage />;
  if (pathname === '/reset-password') return <ResetPasswordPage />;
  if (!user) return null;
  if (pathname === '/guardian') return <ProtectedRoute allowedRoles={['guardian']}><GuardianDashboard /></ProtectedRoute>;
  if (pathname === '/profile' || pathname === '/guardian/profile') return <ProtectedRoute><ProfilePage /></ProtectedRoute>;
  if (pathname === '/staff') return <ProtectedRoute allowedRoles={['special_educator','therapist','psychologist','psychiatrist','school_head','school_admin']}><StaffDashboard /></ProtectedRoute>;
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
  if (pathname === '/reports') return <ProtectedRoute><ReportsPage /></ProtectedRoute>;
  return <PageShell><div className="py-12"><h1 className="font-display text-4xl">Page not found</h1><button className="mt-4 rounded-full border border-ink px-5 py-2 text-sm hover:bg-gallery-white" onClick={() => router.push(user.landing_route)}>Return to dashboard</button></div></PageShell>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><Suspense fallback={<div className="min-h-screen" />}><RouteContent /></Suspense></AuthProvider></QueryClientProvider>;
}
