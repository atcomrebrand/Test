/**
 * Templates de mensagem (§18, §49).
 *
 * O sistema nunca envia nada sozinho — ele só monta o texto e devolve o link do WhatsApp pra pessoa
 * clicar. Essa é uma decisão de produto do briefing, e o domínio reflete ela: não existe função de
 * envio aqui, só de renderização.
 */

export const CUSTOMER_VARIABLES = [
  "nome",
  "valor",
  "data_vencimento",
  "dias_para_vencer",
  "servico",
  "plano",
  "meses_assinante",
  "forma_pagamento",
  "link_pagamento",
  "telefone",
] as const;

export const RESELLER_VARIABLES = [
  "nome",
  "servico",
  "saldo_creditos",
  "clientes_aproximados",
  "valor_recarga",
  "quantidade_creditos",
  "data_ultima_recarga",
  "telefone",
] as const;

export type TemplateVariables = Record<string, string | number | null | undefined>;

export interface RenderResult {
  text: string;
  /** Variáveis que o template pediu e os dados não tinham. A UI avisa antes de abrir o WhatsApp. */
  missing: string[];
}

/** `{{ nome }}`, `{{nome}}` e `{{Nome}}` são a mesma variável — quem escreve o template não deveria
 *  precisar acertar espaço nem caixa. */
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function renderTemplate(body: string, variables: TemplateVariables): RenderResult {
  const missing: string[] = [];

  const normalized = new Map<string, string | number>();
  for (const [key, value] of Object.entries(variables)) {
    if (value !== null && value !== undefined && value !== "") normalized.set(key.toLowerCase(), value);
  }

  const text = body.replace(PLACEHOLDER, (_match, rawName: string) => {
    const name = rawName.toLowerCase();
    const value = normalized.get(name);
    if (value === undefined) {
      if (!missing.includes(name)) missing.push(name);
      // Devolve o placeholder intacto: apagar deixaria "Sua assinatura vence ." e o usuário mandaria
      // a mensagem quebrada sem perceber. Deixando visível, o erro salta aos olhos.
      return `{{${rawName}}}`;
    }
    return String(value);
  });

  return { text, missing };
}

/** Variáveis citadas no corpo, na ordem em que aparecem, sem repetir. */
export function extractVariables(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER)) {
    const name = match[1].toLowerCase();
    if (!found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Normaliza pro formato que o wa.me aceita: só dígitos, com o 55 do Brasil na frente quando o
 * número veio sem código de país. Sem isso o link abre uma conversa vazia e a pessoa acha que o
 * contato sumiu.
 */
export function normalizeWhatsappNumber(raw: string, countryCode = "55"): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;

  // 10 ou 11 dígitos = número nacional (DDD + número), então falta o país.
  if (digits.length <= 11) return `${countryCode}${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, message: string): string | null {
  const number = normalizeWhatsappNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
