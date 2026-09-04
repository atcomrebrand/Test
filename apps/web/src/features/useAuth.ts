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

export interface RegistrationStatus {
  open: boolean;
  reason: string;
}

/**
 * Se este servidor aceita conta nova. Público e sem token — é o que a tela de login consulta antes
 * de mostrar o link de cadastro.
 *
 * Enquanto não responde, o padrão é **fechado**: piscar "Criar conta" e depois esconder é pior do
 * que aparecer meio segundo depois, e a decisão real acontece no servidor de qualquer forma.
 */
export function useRegistrationStatus() {
  return useQuery({
    queryKey: ["auth", "registration-status"],
    queryFn: () => api.get<RegistrationStatus>("/auth/registration-status"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
