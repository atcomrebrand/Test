import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export interface WebAuthnCredentialSummary {
  id: string;
  deviceType: string;
  backedUp: boolean;
  name: string | null;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: { id: string; name: string; email: string };
}

export function useWebAuthnCredentials() {
  return useQuery({
    queryKey: ["webauthn", "credentials"],
    queryFn: () => api.get<WebAuthnCredentialSummary[]>("/webauthn/credentials"),
  });
}

/** Registers this device's Face ID/Touch ID as a passkey for the logged-in account — a Settings
 *  action, never a replacement step during login itself. */
export function useRegisterFaceId() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deviceName?: string) => {
      const optionsJSON = await api.get<PublicKeyCredentialCreationOptionsJSON>("/webauthn/registration-options");
      const response = await startRegistration({ optionsJSON });
      return api.post("/webauthn/registration-verify", { response, deviceName });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webauthn", "credentials"] }),
  });
}

export function useRemoveWebAuthnCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webauthn/credentials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webauthn", "credentials"] }),
  });
}

/** Usernameless login: the device itself offers whichever passkey it has for this site, no email
 *  typed first — this is what makes "just tap Face ID" possible on the login screen. */
export function useLoginWithFaceId() {
  const login = useAuthStore((s) => s.login);
  return useMutation({
    mutationFn: async () => {
      const { attemptId, options } = await api.post<{ attemptId: string; options: PublicKeyCredentialRequestOptionsJSON }>(
        "/webauthn/login-options",
      );
      const response = await startAuthentication({ optionsJSON: options });
      return api.post<AuthResponse>("/webauthn/login-verify", { attemptId, response } satisfies {
        attemptId: string;
        response: AuthenticationResponseJSON;
      });
    },
    onSuccess: (data) => login(data.token, data.user),
  });
}
