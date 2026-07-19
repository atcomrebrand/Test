import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

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
