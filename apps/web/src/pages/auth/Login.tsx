import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from "@simplewebauthn/browser";
import { CreditCard, ScanFace } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useLogin } from "@/features/useAuth";
import { useLoginWithFaceId } from "@/features/useWebAuthn";
import { useAuthStore } from "@/store/auth";

export default function Login() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [faceIdAvailable, setFaceIdAvailable] = useState(false);
  const login = useLogin();
  const loginWithFaceId = useLoginWithFaceId();
  const navigate = useNavigate();

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    platformAuthenticatorIsAvailable().then(setFaceIdAvailable);
  }, []);

  if (isAuthenticated) return <Navigate to="/" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { email, password },
      { onSuccess: () => navigate("/") },
    );
  }

  function onFaceIdLogin() {
    loginWithFaceId.mutate(undefined, {
      onSuccess: () => navigate("/"),
      onError: () => toast.error("Não foi possível entrar com Face ID/Touch ID."),
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--bg))] px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-500 text-white shadow-elevated">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Bem-vindo de volta</h1>
            <p className="text-sm text-muted">Controle suas parcelas com previsibilidade total.</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="surface flex flex-col gap-4 rounded-2xl border border-[rgb(var(--border))] p-6 shadow-soft">
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" loading={login.isPending} className="mt-2 w-full">
            Entrar
          </Button>
        </form>

        {faceIdAvailable && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-[rgb(var(--border))]" />
              ou
              <span className="h-px flex-1 bg-[rgb(var(--border))]" />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              loading={loginWithFaceId.isPending}
              onClick={onFaceIdLogin}
            >
              <ScanFace className="h-4 w-4" /> Entrar com Face ID/Touch ID
            </Button>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          Não tem conta?{" "}
          <Link to="/register" className="font-medium text-accent-500 hover:underline">
            Criar conta
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
