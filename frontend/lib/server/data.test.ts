import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentUser, database } from './auth';
import { getData, postData, requireActor } from './data';

vi.mock('./auth', () => ({
  currentUser: vi.fn(),
  database: vi.fn(),
}));

const currentUserMock = vi.mocked(currentUser);
const databaseMock = vi.mocked(database);

function actor(role: string) {
  return { id: 'user-1', faculty_id: 'FAC-1', email: 'user@example.test', full_name: 'Test User', phone: null, active_role: role, active_school_id: 'school-1', roles: [role], memberships: [], landing_route: '/staff' };
}

afterEach(() => vi.resetAllMocks());

describe('Next.js data API authorization', () => {
  it('rejects unauthenticated data access before querying PostgreSQL', async () => {
    currentUserMock.mockResolvedValue(null);
    await expect(getData(['students'], new Request('https://siddhi.test/api/v1/students')))
      .rejects.toMatchObject({ status: 401, message: 'Authentication required' });
  });

  it('rejects a role that is not permitted before reaching the data query', async () => {
    currentUserMock.mockResolvedValue(actor('guardian'));
    await expect(requireActor(['school_admin']))
      .rejects.toMatchObject({ status: 403, message: 'This role is not permitted to perform this action' });
  });

  it('rejects future attendance dates before writing to PostgreSQL', async () => {
    currentUserMock.mockResolvedValue(actor('school_admin'));
    const query = vi.fn();
    databaseMock.mockReturnValue({ query } as never);
    await expect(postData(['attendance'], { student_id: 'student-1', attendance_date: '2999-01-01', status: 'present' }))
      .rejects.toMatchObject({ status: 400, message: 'Attendance date cannot be in the future' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects reversed attendance filter ranges before querying PostgreSQL', async () => {
    currentUserMock.mockResolvedValue(actor('school_admin'));
    const query = vi.fn();
    databaseMock.mockReturnValue({ query } as never);
    const request = new Request('https://siddhi.test/api/v1/attendance?from_date=2020-01-02&to_date=2020-01-01');
    await expect(getData(['attendance'], request))
      .rejects.toMatchObject({ status: 400, message: 'Date range: From date must be on or before To date' });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects therapy durations above eight hours', async () => {
    currentUserMock.mockResolvedValue(actor('therapist'));
    const query = vi.fn();
    databaseMock.mockReturnValue({ query } as never);
    await expect(postData(['students', 'student-1', 'therapy-sessions'], {
      therapy_type: 'other', session_date: '2020-01-01', duration_minutes: 10000000, progress_notes: 'Test',
    })).rejects.toMatchObject({ status: 400, message: 'Duration must be between 1 and 480 minutes (8 hours)' });
    expect(query).not.toHaveBeenCalled();
  });
});
