import { FormEvent, useEffect, useState } from "react";
import { AtSign, KeyRound, Sparkles, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useChangeEmail, useChangePassword, useUpdateProfile } from "@/features/useAccount";
import { useAuthStore } from "@/store/auth";

const MIN_SENHA = 10;

export function ProfileSettingsCard() {
  const user = useAuthStore((s) => s.user);

  const perfil = useUpdateProfile();
  const trocarEmail = useChangeEmail();
  const trocarSenha = useChangePassword();

  const [nome, setNome] = useState(user?.name ?? "");
  const [apelido, setApelido] = useState(user?.preferredName ?? "");

  const [email, setEmail] = useState(user?.email ?? "");
  const [senhaDoEmail, setSenhaDoEmail] = useState("");

  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [senhaConfirma, setSenhaConfirma] = useState("");

  // Numa carga fria o usuário só chega depois, buscado do /auth/me — e useState só roda uma vez,
  // então sem isto os campos ficariam vazios olhando pra uma conta que existe. Depende do id pra
  // semear uma vez por usuário, e não a cada tecla digitada.
  useEffect(() => {
    if (!user) return;
    setNome(user.name);
    setApelido(user.preferredName ?? "");
    setEmail(user.email);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomeMudou = nome.trim() !== (user?.name ?? "") || apelido.trim() !== (user?.preferredName ?? "");
  const emailMudou = email.trim().toLowerCase() !== (user?.email ?? "").toLowerCase();

  // Conferida aqui e não só no servidor porque a segunda senha existe justamente pra pegar erro de
  // digitação — deixar isso virar ida ao servidor faria a pessoa descobrir o engano tarde demais.
  const senhasDiferem = senhaConfirma.length > 0 && senhaNova !== senhaConfirma;
  const senhaCurta = senhaNova.length > 0 && senhaNova.length < MIN_SENHA;
  const podeTrocarSenha = senhaAtual.length > 0 && senhaNova.length >= MIN_SENHA && senhaNova === senhaConfirma;

  function salvarPerfil(e: FormEvent) {
    e.preventDefault();
    perfil.mutate({ name: nome.trim(), preferredName: apelido.trim() });
  }

  function salvarEmail(e: FormEvent) {
    e.preventDefault();
    trocarEmail.mutate({ email: email.trim(), password: senhaDoEmail }, { onSuccess: () => setSenhaDoEmail("") });
  }

  function salvarSenha(e: FormEvent) {
    e.preventDefault();
    trocarSenha.mutate(
      { currentPassword: senhaAtual, newPassword: senhaNova },
      {
        onSuccess: () => {
          setSenhaAtual("");
          setSenhaNova("");
          setSenhaConfirma("");
        },
      },
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sua conta</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={salvarPerfil} className="flex flex-col gap-3">
          <Input
            label="Seu nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Como você se chama"
            autoComplete="name"
          />
          <Input
            label="Como o assistente te chama"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder={user?.name ? `Vazio = ${user.name}` : "Um apelido, ou o primeiro nome"}
            hint="Deixe em branco pra ele usar o seu nome."
          />
          <Button type="submit" size="sm" className="self-start" loading={perfil.isPending} disabled={!nomeMudou || nome.trim().length < 2}>
            <User className="h-4 w-4" />
            Salvar
          </Button>
        </form>

        <div className="h-px bg-[rgb(var(--border))]" />

        <form onSubmit={salvarEmail} className="flex flex-col gap-3">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            hint="É com ele que você entra no app."
          />
          {/* A senha só aparece quando há mudança de fato: pedir senha num campo que a pessoa nem
              tocou faz o formulário parecer mais hostil do que é. */}
          {emailMudou && (
            <Input
              label="Sua senha, pra confirmar"
              type="password"
              value={senhaDoEmail}
              onChange={(e) => setSenhaDoEmail(e.target.value)}
              autoComplete="current-password"
              hint="Trocar o e-mail muda como você entra na conta, por isso pedimos a senha."
            />
          )}
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="self-start"
            loading={trocarEmail.isPending}
            disabled={!emailMudou || senhaDoEmail.length === 0}
          >
            <AtSign className="h-4 w-4" />
            Alterar e-mail
          </Button>
        </form>

        <div className="h-px bg-[rgb(var(--border))]" />

        <form onSubmit={salvarSenha} className="flex flex-col gap-3">
          <Input
            label="Senha atual"
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            autoComplete="current-password"
          />
          <Input
            label="Nova senha"
            type="password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            autoComplete="new-password"
            error={senhaCurta ? `Pelo menos ${MIN_SENHA} caracteres.` : undefined}
            hint={`Mínimo de ${MIN_SENHA} caracteres.`}
          />
          <Input
            label="Repita a nova senha"
            type="password"
            value={senhaConfirma}
            onChange={(e) => setSenhaConfirma(e.target.value)}
            autoComplete="new-password"
            error={senhasDiferem ? "As duas senhas não batem." : undefined}
          />
          <Button type="submit" size="sm" variant="outline" className="self-start" loading={trocarSenha.isPending} disabled={!podeTrocarSenha}>
            <KeyRound className="h-4 w-4" />
            Alterar senha
          </Button>
        </form>

        <p className="flex items-start gap-1.5 text-xs text-muted">
          <Sparkles className="mt-px h-3.5 w-3.5 shrink-0" />
          O nome e o apelido também valem pro assistente: ele passa a te tratar pelo que estiver no segundo campo.
        </p>
      </CardContent>
    </Card>
  );
}
