import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCreateCrmSubscription, useCrmPaymentMethods, useCrmPlans } from "../api";
import { CrmCustomer } from "../types";

const PERIODOS = [
  { value: "MONTHLY", label: "Mensal" },
  { value: "BIMONTHLY", label: "Bimestral" },
  { value: "QUARTERLY", label: "Trimestral" },
  { value: "SEMIANNUAL", label: "Semestral" },
  { value: "ANNUAL", label: "Anual" },
  { value: "CUSTOM", label: "Personalizado (dias)" },
];

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Nova assinatura. Escolher um plano preenche valor e período — o plano existe justamente pra isso. */
export function SubscriptionModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: CrmCustomer;
}) {
  const { data: plans } = useCrmPlans(customer.portfolioId);
  const { data: methods } = useCrmPaymentMethods();
  const create = useCreateCrmSubscription();

  const [form, setForm] = useState({
    planId: "",
    startDate: hojeISO(),
    dueDate: hojeISO(),
    amount: "",
    billingPeriod: "MONTHLY",
    customDays: "30",
    paymentMethodId: "",
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, startDate: hojeISO(), dueDate: hojeISO() }));
  }, [open]);

  const escolherPlano = (planId: string) => {
    const plan = plans?.find((p) => p.id === planId);
    setForm((f) => ({
      ...f,
      planId,
      ...(plan ? { amount: String(Number(plan.price)), billingPeriod: plan.billingPeriod } : {}),
    }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        customerId: customer.id,
        planId: form.planId || undefined,
        startDate: new Date(form.startDate).toISOString(),
        dueDate: new Date(form.dueDate).toISOString(),
        amount: Number(form.amount),
        billingPeriod: form.billingPeriod,
        customDays: form.billingPeriod === "CUSTOM" ? Number(form.customDays) : undefined,
        paymentMethodId: form.paymentMethodId || undefined,
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Nova assinatura" size="lg">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select
          label="Plano"
          value={form.planId}
          onChange={(e) => escolherPlano(e.target.value)}
          options={[
            { value: "", label: "Sem plano (valor avulso)" },
            ...(plans ?? []).map((p) => ({ value: p.id, label: `${p.name} — R$ ${Number(p.price).toFixed(2)}` })),
          ]}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Cliente desde"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            required
          />
          <Input
            label="Vence em"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            required
          />
          <Input
            label="Valor"
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
          <Select
            label="Período"
            value={form.billingPeriod}
            onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
            options={PERIODOS}
          />
          {form.billingPeriod === "CUSTOM" && (
            <Input
              label="A cada quantos dias"
              type="number"
              min="1"
              value={form.customDays}
              onChange={(e) => setForm({ ...form, customDays: e.target.value })}
            />
          )}
          <Select
            label="Forma de pagamento"
            value={form.paymentMethodId}
            onChange={(e) => setForm({ ...form, paymentMethodId: e.target.value })}
            options={[
              { value: "", label: "Definir na renovação" },
              ...(methods ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
        </div>

        <p className="text-xs text-muted">
          "Cliente desde" é o marco de tempo de casa — se ele já era cliente antes, coloque a data real.
        </p>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Criar assinatura
          </Button>
        </div>
      </form>
    </Modal>
  );
}
