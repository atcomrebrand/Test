import {
  LayoutDashboard,
  CreditCard,
  ShoppingBag,
  ListChecks,
  CalendarDays,
  History,
  Tags,
  BarChart3,
  Trash2,
  Settings,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export interface HelpTopic {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string;
  tips: string[];
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    summary:
      "Sua visão geral: quanto você já comprometeu este mês e no próximo, quanto ainda falta pagar no total, quantas parcelas estão em aberto, e o percentual do limite usado somando todos os cartões ativos.",
    tips: [
      "Os números são recalculados na hora sempre que você lança uma compra ou marca uma parcela como paga.",
      "\"Valor estimado da próxima fatura\" mostra quanto vai fechar no mês seguinte, considerando todos os cartões.",
      "O gráfico de evolução mostra 6 meses passados e 6 futuros, então dá pra ver picos de gastos chegando.",
    ],
  },
  {
    id: "cards",
    title: "Cartões",
    icon: CreditCard,
    summary:
      "Cadastre todos os seus cartões de crédito aqui. Os dias de fechamento e vencimento são o coração do sistema: é com base neles que cada parcela é automaticamente colocada na fatura certa.",
    tips: [
      "Compra feita até o dia do fechamento entra na fatura atual; depois do fechamento, vai pra próxima.",
      "Cartões inativos não podem receber novas compras, mas continuam contando nas suas estatísticas históricas.",
      "Toque no cartão pra editar; o ícone de energia ativa/desativa sem precisar excluir.",
    ],
  },
  {
    id: "purchases",
    title: "Compras",
    icon: ShoppingBag,
    summary:
      "Toda compra — parcelada, à vista ou assinatura recorrente (tipo Netflix) — é lançada aqui. Ao preencher valor e número de parcelas, você já vê uma prévia de cada parcela e em qual mês ela cai.",
    tips: [
      "Em parcelada, você informa o valor de cada parcela direto (não o total) — é o mesmo número que aparece na sua fatura, sem entrada e sem cálculo de juros.",
      "Parcelamento já em andamento? Marque \"já está em andamento\", diga quantas parcelas já foram pagas e a data da próxima em aberto — o sistema marca as anteriores como pagas automaticamente.",
      "Em compra à vista ou parcelada nova, a data é quando você comprou, e o sistema calcula a fatura certa pelo dia de fechamento do cartão.",
      "Em assinatura, a data é o \"Próximo pagamento\" — o dia em que ela cobra no cartão todo mês, direto, sem passar pelo cálculo de fechamento de fatura.",
      "Marque \"Favorita\" pra destacar compras importantes e filtrar por elas depois.",
      "Use \"Duplicar\" pra repetir rapidamente uma compra parecida sem preencher tudo de novo.",
      "Excluir uma compra manda ela pra Lixeira — nada some de vez até você confirmar lá.",
    ],
  },
  {
    id: "installments",
    title: "Parcelas",
    icon: ListChecks,
    summary:
      "Lista de cada parcela individual gerada pelas suas compras, com status: Pendente, Pago, Atrasado ou Cancelado.",
    tips: [
      "Marque como paga assim que o pagamento cair na fatura — isso atualiza todos os indicadores do Dashboard na hora.",
      "Parcelas com vencimento no passado e ainda pendentes viram \"Atrasado\" automaticamente.",
      "Dá pra reverter um pagamento marcado por engano com o botão de desfazer.",
    ],
  },
  {
    id: "financing",
    title: "Financiamentos",
    icon: Landmark,
    summary:
      "Controle financiamentos de carro, moto ou casa separadamente dos seus cartões. Você informa o valor fixo da parcela (sem cálculo de juros) e o sistema gera todas as parcelas automaticamente.",
    tips: [
      "Financiamento já em andamento? Informe quantas parcelas já foram pagas e a data da próxima parcela — o sistema monta o resto (as parcelas já pagas entram marcadas como pagas automaticamente).",
      "Depois de criado, o valor da parcela e o número de parcelas não podem ser editados — exclua e recadastre se o contrato mudar.",
      "\"Quitação à vista\" pode ser informada já no cadastro e atualizada depois toda vez que receber uma proposta nova do banco.",
      "O resumo aparece no Dashboard automaticamente assim que você tiver pelo menos um financiamento ativo.",
    ],
  },
  {
    id: "calendar",
    title: "Calendário",
    icon: CalendarDays,
    summary:
      "Visão mês a mês de quanto você tem comprometido, com a cor de cada mês indicando o peso financeiro dele.",
    tips: [
      "Clique em qualquer mês pra ver a lista exata de parcelas que caem nele.",
      "Meses mais \"pesados\" (vermelho) ajudam a identificar picos de gasto com antecedência.",
    ],
  },
  {
    id: "timeline",
    title: "Linha do Tempo",
    icon: History,
    summary:
      "As mesmas parcelas do Calendário, organizadas cronologicamente com a numeração de cada uma (ex: 3/12), pra acompanhar a evolução de uma compra parcelada mês a mês.",
    tips: ["O mês atual fica destacado com uma bolinha preenchida na linha do tempo."],
  },
  {
    id: "categories",
    title: "Categorias",
    icon: Tags,
    summary:
      "Classifique compras por categoria (Mercado, Lazer, Eletrônicos...) pra entender pra onde seu dinheiro está indo.",
    tips: [
      "Categorias padrão não podem ser editadas ou excluídas, mas você pode criar quantas categorias personalizadas quiser.",
      "Uma categoria só pode ser excluída se nenhuma compra estiver usando ela.",
    ],
  },
  {
    id: "statistics",
    title: "Estatísticas",
    icon: BarChart3,
    summary:
      "Números consolidados: quanto você já pagou, quanto falta, sua maior compra, a categoria que mais pesa, e a comparação entre valores parcelados e à vista.",
    tips: ["\"Restante por cartão\" ajuda a decidir qual fatura priorizar quando o orçamento aperta."],
  },
  {
    id: "trash",
    title: "Lixeira",
    icon: Trash2,
    summary: "Compras excluídas ficam aqui antes de sumir de vez.",
    tips: [
      "Restaure a qualquer momento se excluiu algo sem querer.",
      "A exclusão permanente na Lixeira não pode ser desfeita.",
    ],
  },
  {
    id: "settings",
    title: "Configurações",
    icon: Settings,
    summary:
      "Ajuste tema, moeda, o percentual de limite que dispara alerta, quais notificações você recebe, exporte suas parcelas em CSV, e gerencie sua conta.",
    tips: [
      "\"Zerar dados\" apaga cartões e compras mas mantém seu login — ótimo pra recomeçar um teste.",
      "\"Excluir conta\" é definitivo e remove tudo, incluindo o login.",
    ],
  },
];

export const CLOSING_DAY_EXAMPLE = {
  title: "Como o sistema decide a fatura de cada parcela",
  body: "Se o fechamento do cartão é dia 10: uma compra feita no dia 8 entra na fatura atual (a 1ª parcela vence já no próximo vencimento); uma compra feita no dia 12 só entra na fatura seguinte, porque o cartão já fechou. O sistema calcula isso sozinho pra toda compra que você lança — você só escolhe o cartão e a data.",
};
