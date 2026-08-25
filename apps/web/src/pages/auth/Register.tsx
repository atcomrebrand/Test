import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useRegister, useRegistrationStatus } from "@/features/useAuth";
import { useAuthStore } from "@/store/auth";

export default function Register() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const register = useRegister();
  const { data: registration, isLoading: verificando } = useRegistrationStatus();
  // Enquanto não sabe, não mostra nem um nem outro: piscar o formulário e depois trocar por
  // "indisponível" é pior do que esperar meio segundo.
  const fechado = !verificando && registration?.open === false;
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/" replace />;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    register.mutate({ name, email, password }, { onSuccess: () => navigate("/") });
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
            <h1 className="text-xl font-bold">{fechado ? "Cadastro indisponível" : "Crie sua conta"}</h1>
            <p className="text-sm text-muted">
              {fechado ? registration?.reason : "Comece a organizar suas parcelas em minutos."}
            </p>
          </div>
        </div>

        {/* Quem chegou aqui por link direto vê a porta fechada em vez de preencher um formulário
            que o servidor vai recusar no envio. */}
        {fechado && (
          <div className="surface flex flex-col gap-3 rounded-2xl border border-[rgb(var(--border))] p-6 text-center shadow-soft">
            <p className="text-sm text-muted">Este servidor não está aceitando contas novas.</p>
            <Link to="/login" className="text-sm font-medium text-accent-500 hover:underline">
              Voltar pro login
            </Link>
          </div>
        )}

        {!fechado && (
        <form onSubmit={onSubmit} className="surface flex flex-col gap-4 rounded-2xl border border-[rgb(var(--border))] p-6 shadow-soft">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
          <Button type="submit" loading={register.isPending} className="mt-2 w-full">
            Criar conta
          </Button>
        </form>
        )}

        {!fechado && (
          <p className="mt-6 text-center text-sm text-muted">
            Já tem conta?{" "}
            <Link to="/login" className="font-medium text-accent-500 hover:underline">
              Entrar
            </Link>
          </p>
        )}
      </motion.div>
    </div>
  );
}
