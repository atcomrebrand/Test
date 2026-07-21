import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { AppLockGate } from "./AppLockGate";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLockGate />;
}
