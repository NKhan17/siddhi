'use client';

import { useAuth } from '../../app/AuthContext';
import GuardianProfilePage from '../guardian/GuardianProfilePage';
import StaffProfilePage from './StaffProfilePage';

export default function ProfilePage() {
  const { user } = useAuth();
  if (!user) return null;
  return user.active_role === 'guardian' ? <GuardianProfilePage /> : <StaffProfilePage />;
}
