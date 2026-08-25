/**
 * Quem pode criar conta.
 *
 * O app é de uma pessoa só e está exposto na internet: cadastro aberto é uma porta pra qualquer um
 * entrar autenticado e ficar explorando a API por dentro — inclusive as telas de diagnóstico. Só
 * que fechar por padrão sem mais nada quebra a instalação nova, que precisa criar a primeira conta.
 *
 * Daí as três situações abaixo. Regra pura de propósito: quem chama passa a variável de ambiente e
 * quantos usuários existem, e o que sai é decisão pronta com motivo escrito.
 */

export interface RegistrationDecision {
  open: boolean;
  /** Texto mostrado na tela e no erro da API — "fechado" sem porquê vira suporte. */
  reason: string;
}

export function decideRegistration(flag: string | undefined, existingUsers: number): RegistrationDecision {
  const normalizado = (flag ?? "").trim().toLowerCase();

  // Explícito manda nos dois sentidos: quem ligou sabe o que está fazendo, e quem desligou também
  // — inclusive pra travar uma instalação vazia de propósito, antes de ela ser descoberta.
  if (normalizado === "true" || normalizado === "1") {
    return { open: true, reason: "Cadastro liberado por configuração do servidor." };
  }
  if (normalizado === "false" || normalizado === "0") {
    return { open: false, reason: "O cadastro de novas contas está desativado." };
  }

  // Sem configuração: aberto só enquanto não existe ninguém. É o que deixa a instalação nova criar
  // o dono e se fechar sozinha no instante seguinte, sem depender de alguém lembrar de uma flag.
  if (existingUsers === 0) {
    return { open: true, reason: "Primeira conta do servidor — o cadastro fecha sozinho depois dela." };
  }

  return { open: false, reason: "O cadastro de novas contas está desativado." };
}
