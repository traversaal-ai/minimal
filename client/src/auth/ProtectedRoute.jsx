import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from './SessionProvider.jsx';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSession();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
