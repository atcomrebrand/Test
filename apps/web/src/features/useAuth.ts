import { useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface SessionUser {
  id: string;
  name: string;
  preferredName: string | null;
  email: string;
}

interface AuthResponse {
  token: string;
  user: SessionUser;
}

/**
 * Repõe o usuário da sessão a partir do token guardado.
 *
 * O store só recebia o usuário na resposta do login, e ele vive em memória — ou seja, a cada
 * recarga de página o app sabia que estava autenticado mas não sabia quem era. Dava pra ver no
 * "Olá" da Home, que perdia o nome depois de um F5, e quebraria de vez a tela de conta, que
 * preenche os campos a partir desse usuário.
 */
export function useSessionUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<SessionUser>("/auth/me"),
    enabled: isAuthenticated && user === null,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (data) setUser(data);
  }, [data, setUser]);
}

export function useLogin() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<AuthResponse>("/auth/login", data),
    onSuccess: (data) => login(data.token, data.user),
  });
}

export function useRegister() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.post<AuthResponse>("/auth/register", data),
    onSuccess: (data) => login(data.token, data.user),
  });
}
