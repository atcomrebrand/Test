import { FormEvent, useEffect, useMemo, useState } from "react";
import { Repeat } from "lucide-react";
import { matchServiceIcon } from "@/lib/serviceIcons";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useCards } from "@/features/useCards";
import { useCategories } from "@/features/useCategories";
import { useCreatePurchase } from "@/features/usePurchases";
import { previewRecurringOccurrence } from "@/lib/installmentPreview";
import { formatCurrency, formatDate } from "@/lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SubscriptionFormModal({ open, onClose }: Props) {
  const { data: cards } = useCards();
  const { data: categories } = useCategories();
  const create = useCreatePurchase();

  const [form, setForm] = useState({
    name: "",
    cardId: "",
    categoryId: "",
    merchant: "",
    notes: "",
    totalAmount: "",
    purchaseDate: todayISO(),
    billingCycle: "MONTHLY" as "MONTHLY" | "ANNUAL",
    autoRenew: true,
    recurrenceEndDate: "",
    tags: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        cardId: cards?.[0]?.id ?? "",
        categoryId: "",
        merchant: "",
        notes: "",
        totalAmount: "",
        purchaseDate: todayISO(),
        billingCycle: "MONTHLY",
        autoRenew: true,
        recurrenceEndDate: "",
        tags: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cards]);

  const activeCards = (cards ?? []).filter((c) => c.active);

  const preview = useMemo(
    () =>
      previewRecurringOccurrence({
        nextPaymentDate: new Date(form.purchaseDate + "T12:00:00"),
        monthlyAmount: Number(form.totalAmount) || 0,
      }),
    [form.purchaseDate, form.totalAmount],
  );

  const serviceMatch = useMemo(() => matchServiceIcon(form.name), [form.name]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        name: form.name,
        cardId: form.cardId,
        categoryId: form.categoryId || undefined,
        merchant: form.merchant || undefined,
        notes: form.notes || undefined,
        totalAmount: Number(form.totalAmount),
        purchaseDate: new Date(form.purchaseDate + "T12:00:00").toISOString(),
        kind: "RECURRING",
        billingCycle: form.billingCycle,
        autoRenew: form.autoRenew,
        recurrenceEndDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate + "T12:00:00").toISOString() : undefined,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova assinatura" size="xl">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          label="Nome da assinatura"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Netflix, Spotify, Registro do domínio"
          required
        />

        <Select
          label="Cartão"
          options={activeCards.map((c) => ({ value: c.id, label: c.name }))}
          value={form.cardId}
          onChange={(e) => setForm({ ...form, cardId: e.target.value })}
          required
        />
        <Select
          label="Categoria"
          options={[{ value: "", label: "Sem categoria" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={form.categoryId}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        />

        <Input label="Estabelecimento" value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
        <Input
          label="Próximo pagamento"
          type="date"
          value={form.purchaseDate}
          onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
          hint="Dia em que ela cobra no cartão — não a fatura inteira."
          required
        />

        <div>
          <Label>Ciclo de cobrança</Label>
          <Tabs
            value={form.billingCycle}
            onChange={(v) => setForm({ ...form, billingCycle: v as "MONTHLY" | "ANNUAL" })}
            options={[
              { value: "MONTHLY", label: "Mensal" },
              { value: "ANNUAL", label: "Anual" },
            ]}
          />
        </div>
        <Input
          label={form.billingCycle === "ANNUAL" ? "Valor por ano (R$)" : "Valor mensal (R$)"}
          type="number"
          step="0.01"
          min="0.01"
          value={form.totalAmount}
          onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
          required
        />

        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.autoRenew}
            onChange={(e) => setForm({ ...form, autoRenew: e.target.checked })}
            className="h-4 w-4 rounded accent-accent-500"
          />
          Renovação automática
        </label>
        <Input
          label="Data de término (opcional)"
          type="date"
          min={form.purchaseDate}
          value={form.recurrenceEndDate}
          onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
          hint="Deixe em branco para uma assinatura sem prazo — cancele quando quiser depois."
        />

        <Textarea
          className="sm:col-span-2"
          label="Observações"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <Input
          className="sm:col-span-2"
          label="Tags (separadas por vírgula)"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder="Ex: trabalho, streaming"
        />

        {preview && (
          <div className="sm:col-span-2 flex items-start gap-3 rounded-2xl surface-2 p-4">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${serviceMatch ? "" : "bg-accent-500/10 text-accent-500"}`}
              style={serviceMatch ? { backgroundColor: `${serviceMatch.color}1a` } : undefined}
            >
              {serviceMatch ? (
                <serviceMatch.Icon className="h-4 w-4" style={{ color: serviceMatch.color }} />
              ) : (
                <Repeat className="h-4 w-4" />
              )}
            </span>
            <div className="text-sm">
              <p className="font-semibold">
                {formatCurrency(preview.amount)} {form.billingCycle === "ANNUAL" ? "por ano" : "todo mês"}, a partir de{" "}
                {formatDate(preview.dueDate)}
              </p>
              <p className="mt-1 text-muted">
                {form.recurrenceEndDate
                  ? `Cobranças automáticas até ${formatDate(form.recurrenceEndDate + "T12:00:00")}.`
                  : form.autoRenew
                    ? "Renova sozinha — cancele quando quiser na lista de assinaturas."
                    : "Sem renovação automática — vale ficar de olho na data acima."}
              </p>
            </div>
          </div>
        )}

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Adicionar assinatura
          </Button>
        </div>
      </form>
    </Modal>
  );
}
