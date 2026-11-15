'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader, Card, LoadingState, ErrorState, EmptyState, Button, Modal, Field, Input, Select, StatusBadge, DataTable } from '../../components/ui';
import { formatDate, todayISODate } from '../../lib/utils';

type StudentAttendance = {
  student_id: string; full_name: string; grade_class: string; disability_category: string;
  total_days: number; present: number; absent: number; leave: number; other: number; attendance_pct: number | null;
};
type AttendanceRow = {
  id: string; student_id: string; student_name: string; grade_class: string; attendance_date: string;
  status: 'present' | 'absent' | 'leave' | 'other'; reason?: string; recorded_by_name?: string;
};
type AttendanceData = { students: StudentAttendance[]; records: AttendanceRow[] };

export default function AllAttendancePage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const today = todayISODate();

  const { data, isLoading, error } = useQuery<AttendanceData>({
    queryKey: ['school-attendance', fromDate, toDate],
    queryFn: () => api.get('/attendance', { from_date: fromDate || undefined, to_date: toDate || undefined }),
  });
  const students = data?.students ?? [];
  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    return term ? students.filter(student => `${student.full_name} ${student.grade_class}`.toLowerCase().includes(term)) : students;
  }, [students, studentSearch]);
  const filteredRecords = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    const records = data?.records ?? [];
    return term ? records.filter(record => `${record.student_name} ${record.grade_class} ${record.status} ${record.reason ?? ''}`.toLowerCase().includes(term)) : records;
  }, [data?.records, studentSearch]);
  const totals = useMemo(() => students.reduce((acc, s) => ({
    students: acc.students + 1, days: acc.days + s.total_days, present: acc.present + s.present, absent: acc.absent + s.absent,
  }), { students: 0, days: 0, present: 0, absent: 0 }), [students]);

  const mutation = useMutation({
    mutationFn: () => api.post('/attendance', { student_id: studentId, attendance_date: attendanceDate, status, reason: reason.trim() || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      setModalOpen(false); setServerError(null); setStudentId(''); setReason('');
    },
    onError: (err) => setServerError(err instanceof Error ? err.message : 'Unable to save attendance.'),
  });

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <PageHeader title="School Attendance" subtitle="Attendance overview across your assigned students" actions={<Button onClick={() => { setServerError(null); setModalOpen(true); }}><Plus size={16} /> Record Attendance</Button>} />
        {isLoading && <LoadingState />}
        {error && <ErrorState message="Unable to load school attendance." onRetry={() => queryClient.invalidateQueries({ queryKey: ['school-attendance'] })} />}
        {data && <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4"><p className="text-xs text-graphite">Students</p><p className="mt-1 text-2xl font-medium text-ink-black">{totals.students}</p></Card>
            <Card className="p-4"><p className="text-xs text-graphite">Attendance entries</p><p className="mt-1 text-2xl font-medium text-ink-black">{totals.days}</p></Card>
            <Card className="p-4"><p className="text-xs text-graphite">Present</p><p className="mt-1 text-2xl font-medium text-ink-black">{totals.present}</p></Card>
            <Card className="p-4"><p className="text-xs text-graphite">Absent</p><p className="mt-1 text-2xl font-medium text-ink-black">{totals.absent}</p></Card>
          </div>
          <Card className="mb-6 p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-medium text-ink-black">Attendance by student</h2>
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" aria-hidden="true" />
                <Input type="search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Search students… (Ctrl+F)" aria-label="Search attendance students" data-app-search-input="true" className="pl-9" />
              </div>
            </div>
            <DataTable columns={[
              { key: 'student', header: 'Student', render: s => <span className="font-medium text-ink-black">{s.full_name}</span> },
              { key: 'grade', header: 'Grade', render: s => <span className="text-graphite">{s.grade_class}</span> },
              { key: 'days', header: 'Days recorded', render: s => s.total_days },
              { key: 'present', header: 'Present', render: s => s.present },
              { key: 'absent', header: 'Absent', render: s => s.absent },
              { key: 'rate', header: 'Attendance %', render: s => <span className="font-medium text-ink-black">{s.attendance_pct == null ? '—' : `${s.attendance_pct}%`}</span> },
            ]} data={filteredStudents} keyExtractor={s => s.student_id} />
            {students.length === 0 && <EmptyState title="No students are assigned to this account" />}
            {students.length > 0 && filteredStudents.length === 0 && <EmptyState title="No matching students" description="Try another name or class." />}
          </Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-ink-black">Daily attendance log</h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-graphite">From <Input aria-label="From date" type="date" max={toDate || today} value={fromDate} onChange={e => setFromDate(e.target.value)} className="ml-1 w-auto" /></label>
              <label className="text-xs text-graphite">To <Input aria-label="To date" type="date" min={fromDate || undefined} max={today} value={toDate} onChange={e => setToDate(e.target.value)} className="ml-1 w-auto" /></label>
              {(fromDate || toDate) && <Button variant="ghost" size="sm" onClick={() => { setFromDate(''); setToDate(''); }}>Clear</Button>}
            </div>
          </div>
          {filteredRecords.length ? <DataTable columns={[
            { key: 'date', header: 'Date', render: r => formatDate(r.attendance_date) },
            { key: 'student', header: 'Student', render: r => <span className="font-medium text-ink-black">{r.student_name}</span> },
            { key: 'grade', header: 'Grade', render: r => r.grade_class },
            { key: 'status', header: 'Status', render: r => <StatusBadge status={r.status} /> },
            { key: 'reason', header: 'Reason', render: r => r.reason || '—' },
            { key: 'by', header: 'Recorded by', render: r => r.recorded_by_name || '—' },
          ]} data={filteredRecords} keyExtractor={r => r.id} /> : <EmptyState title={studentSearch ? 'No matching attendance records' : 'No attendance records for this period'} />}
        </>}
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Record Attendance" footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={() => mutation.mutate()} loading={mutation.isPending} disabled={!studentId || !attendanceDate}>Save</Button></>}>
          <div className="space-y-4">
            <Field label="Find student" htmlFor="all-attendance-student-search"><Input id="all-attendance-student-search" type="search" value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Search by name or class…" data-app-search-input="true" /></Field>
            <Field label="Student" htmlFor="all-attendance-student" required><Select id="all-attendance-student" value={studentId} onChange={e => setStudentId(e.target.value)}><option value="">Select student…</option>{filteredStudents.map(s => <option key={s.student_id} value={s.student_id}>{s.full_name} · {s.grade_class}</option>)}</Select></Field>
            <Field label="Date" htmlFor="all-attendance-date" required><Input id="all-attendance-date" type="date" max={today} value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} /></Field>
            <Field label="Status" htmlFor="all-attendance-status" required><Select id="all-attendance-status" value={status} onChange={e => setStatus(e.target.value)}><option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option><option value="other">Other</option></Select></Field>
            <Field label="Reason (optional)" htmlFor="all-attendance-reason"><Input id="all-attendance-reason" value={reason} onChange={e => setReason(e.target.value)} /></Field>
            {serverError && <p className="text-xs text-error-text" role="alert">{serverError}</p>}
          </div>
        </Modal>
      </div>
    </>
  );
}
