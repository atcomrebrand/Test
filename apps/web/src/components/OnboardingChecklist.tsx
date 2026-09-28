import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, CreditCard, ShoppingBag, Compass, HelpCircle } from "lucide-react";
import { useUiStore } from "@/store/ui";

interface Step {
  done: boolean;
  title: string;
  description: string;
  icon: typeof CreditCard;
  to?: string;
  onClick?: () => void;
  actionLabel: string;
}

interface Props {
  hasCards: boolean;
  hasPurchases: boolean;
}

export function OnboardingChecklist({ hasCards, hasPurchases }: Props) {
  const openHelp = useUiStore((s) => s.openHelp);

  const steps: Step[] = [
    {
      done: hasCards,
      title: "Cadastre seu primeiro cartão",
      description: "Informe o dia de fechamento e vencimento — é a base de todo o cálculo automático de parcelas.",
      icon: CreditCard,
      to: "/cards",
      actionLabel: "Cadastrar cartão",
    },
    {
      done: hasPurchases,
      title: "Lance sua primeira compra",
      description: "Parcelada, à vista ou assinatura recorrente — o sistema já monta as parcelas pra você.",
      icon: ShoppingBag,
      to: "/purchases",
      actionLabel: "Nova compra",
    },
    {
      done: false,
      title: "Explore o Calendário e a Central de Ajuda",
      description: "Veja o peso de cada mês no Calendário, e tire dúvidas sobre qualquer tela na Central de Ajuda.",
      icon: Compass,
      onClick: () => openHelp(),
      actionLabel: "Abrir ajuda",
    },
  ];

  // Step 3 ("explore") has no trackable completion state — it's a standing tip, not a
  // blocker. The checklist itself only needs to disappear once the two real setup
  // actions (add a card, launch a purchase) are done.
  const trackableSteps = steps.slice(0, 2);
  const completedCount = trackableSteps.filter((s) => s.done).length;
  if (completedCount === trackableSteps.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-accent-500/30 bg-accent-500/5 p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-accent-500" />
          <h2 className="font-semibold">Primeiros passos</h2>
        </div>
        <span className="text-xs font-medium text-muted">
          {completedCount}/{trackableSteps.length} concluído{completedCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((step) => {
          const content = (
            <>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  step.done ? "bg-emerald-500/15 text-emerald-500" : "surface text-accent-500"
                }`}
              >
                {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs text-muted">{step.description}</p>
                {!step.done && <span className="mt-1.5 inline-block text-xs font-medium text-accent-500">{step.actionLabel} →</span>}
              </div>
            </>
          );

          const className = `flex items-start gap-3 rounded-xl p-3 transition-colors ${
            step.done ? "opacity-60" : "surface hover:shadow-soft"
          }`;

          if (step.done) return <div key={step.title} className={className}>{content}</div>;
          if (step.to)
            return (
              <Link key={step.title} to={step.to} className={className}>
                {content}
              </Link>
            );
          return (
            <button key={step.title} onClick={step.onClick} className={`${className} text-left`}>
              {content}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
