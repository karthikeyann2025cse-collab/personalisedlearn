import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '../../store';

export function AppLayout() {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-screen overflow-hidden bg-mesh">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
