import { UserTracking } from '@/components/admin/UserTracking';

/** Administration → Suivi des utilisateurs (D-102) : lecture seule, réservé à l'administrateur de la plateforme. */
export default function AdminUsersScreen() {
  return <UserTracking />;
}
