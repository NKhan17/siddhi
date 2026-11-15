import { NextRequest, NextResponse } from 'next/server';
import { currentUser, database, login, logout, refreshSession, requestPasswordReset, resetPassword, selectRole } from '../../../lib/server/auth';
import { getData, postData, patchData, exportWorkbook, requireActor } from '../../../lib/server/data';
import { cookies } from 'next/headers';

type RouteContext = { params: Promise<{ path: string[] }> };

function errorResponse(error: unknown) {
  const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
  const detail = error instanceof Error ? error.message : 'Unexpected server error';
  if (status >= 500) console.error('[api]', error);
  return NextResponse.json({ detail: status >= 500 ? 'An unexpected server error occurred.' : detail }, { status: status || 500 });
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const path = (await context.params).path;
    const route = path.slice(1).join('/');
    if (path[0] !== 'v1') return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (route === 'auth/login') {
      const body = await request.json();
      const result = await login(body.identifier, body.password, body.client_mode || 'staff');
      return result ? NextResponse.json(result) : NextResponse.json({ detail: 'Invalid email or password' }, { status: 401 });
    }
    if (route === 'auth/select-role') {
      const body = await request.json();
      const user = await selectRole(body.role || '', body.school_id);
      return user ? NextResponse.json(user) : NextResponse.json({ detail: 'Role is not assigned to this account.' }, { status: 403 });
    }
    if (route === 'auth/forgot-password') {
      const body = await request.json();
      return NextResponse.json(await requestPasswordReset(body.email || ''));
    }
    if (route === 'auth/reset-password') {
      const body = await request.json();
      return NextResponse.json(await resetPassword(body.token || '', body.new_password || ''));
    }
    if (route === 'auth/logout') {
      await logout();
      return NextResponse.json({ message: 'Successfully logged out' });
    }
    if (route === 'admin/repair-therapy-duration') {
      await requireActor(['school_admin']);
      const db = database();
      const normalized = await db.query(`UPDATE therapy_sessions SET duration_minutes=60,updated_at=NOW() WHERE duration_minutes>480 RETURNING id`);
      await db.query(`UPDATE therapy_sessions SET duration_minutes=1,updated_at=NOW() WHERE duration_minutes<1`);
      await db.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ck_therapy_sessions_duration_minutes') THEN ALTER TABLE therapy_sessions ADD CONSTRAINT ck_therapy_sessions_duration_minutes CHECK (duration_minutes BETWEEN 1 AND 480); END IF; END $$`);
      return NextResponse.json({ normalized_sessions: normalized.rowCount ?? 0, duration_constraint: '1..480 minutes' });
    }
    if (route === 'auth/refresh') {
      const refreshed = await refreshSession((await cookies()).get('refresh_token')?.value);
      return refreshed ? NextResponse.json({ access_token: refreshed.accessToken, refresh_token: refreshed.refreshToken, token_type: 'bearer' }) : NextResponse.json({ detail: 'Invalid or expired session' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (route === 'exports/iep-workbook') {
      const workbook = await exportWorkbook(body);
      const filename = `Siddhi_IEP_${new Date().toISOString().slice(0,10).replaceAll('-','')}.xlsx`;
      return new NextResponse(workbook, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${filename}"` } });
    }
    return NextResponse.json(await postData(path.slice(1), body), { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const path = (await context.params).path;
    if (path[0] !== 'v1') return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    if (path.slice(1).join('/') === 'auth/me') {
      const user = await currentUser();
      return user ? NextResponse.json(user) : NextResponse.json({ detail: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json(await getData(path.slice(1), request));
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const path = (await context.params).path;
    if (path[0] !== 'v1') return NextResponse.json({ detail: 'Not found' }, { status: 404 });
    const body = await request.json();
    return NextResponse.json(await patchData(path.slice(1), body));
  } catch (error) { return errorResponse(error); }
}
