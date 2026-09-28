import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { useSessionUser } from "@/features/useAuth";
import { AppLockGate } from "./AppLockGate";

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Roda aqui porque é o ponto por onde toda tela autenticada passa, inclusive numa carga fria.
  useSessionUser();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppLockGate />;
}
