import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface PerfilAtualizado {
  id: string;
  name: string;
  preferredName: string | null;
  email: string;
}

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: { name?: string; preferredName?: string }) => api.patch<PerfilAtualizado>("/account/profile", data),
    // Atualiza a sessão na hora: o nome aparece no "Olá, Fulano" da Home e no cabeçalho, e sem isso
    // continuaria mostrando o antigo até o próximo login.
    onSuccess: (user) => {
      setUser(user);
      toast.success("Perfil atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangeEmail() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (data: { email: string; password: string }) => api.patch<PerfilAtualizado>("/account/email", data),
    onSuccess: (user) => {
      setUser(user);
      toast.success("E-mail alterado! Use o novo no próximo login.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) => api.patch("/account/password", data),
    onSuccess: () => toast.success("Senha alterada!"),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResetAccountData() {
  return useMutation({
    mutationFn: () => api.post("/account/reset-data", { confirmText: "ZERAR" }),
  });
}

export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: (password: string) => api.delete("/account", { data: { password } }),
    onSuccess: () => logout(),
  });
}
