import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDate } from "@/lib/format";
import { CrmDueCustomer } from "../types";
import { PortfolioDot } from "./StatusBadge";
import { RenewButton, WhatsappButton } from "./QuickActions";

/**
 * Linha do painel de vencimentos: nome, quanto, quando e as duas ações que resolvem o caso —
 * mandar mensagem e renovar. É o §60 inteiro numa linha: olhar quem precisa de atenção, clicar,
 * pronto.
 */
export function DueRow({ customer, tone }: { customer: CrmDueCustomer; tone: "today" | "tomorrow" | "late" }) {
  const subscription = customer.subscriptions[0];

  const border = {
    today: "border-l-amber-500",
    tomorrow: "border-l-sky-500",
    late: "border-l-red-500",
  }[tone];

  const categories = tone === "late" ? (["DELINQUENCY", "RENEWAL"] as const) : (["DUE", "RENEWAL"] as const);

  return (
    <Card className={cn("border-l-4", border)}>
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <Link to={`/crm/clientes/${customer.id}`} className="truncate text-sm font-medium hover:underline">
            {customer.nickname || customer.name}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <PortfolioDot name={customer.portfolio.name} color={customer.portfolio.color} />
            {customer.currentDueDate && (
              <span className="text-xs text-muted">· {formatDate(customer.currentDueDate)}</span>
            )}
          </div>
        </div>

        {subscription && <span className="font-semibold">{formatCurrency(subscription.amount)}</span>}

        <div className="flex items-center gap-1.5">
          <WhatsappButton customerId={customer.id} categories={[...categories]} />
          <RenewButton subscriptionId={subscription?.id} />
        </div>
      </CardContent>
    </Card>
  );
}
