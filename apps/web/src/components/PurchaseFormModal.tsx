import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Repeat } from "lucide-react";
import { matchServiceIcon } from "@/lib/serviceIcons";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useCards } from "@/features/useCards";
import { useCategories } from "@/features/useCategories";
import { useCreatePurchase, useUpdatePurchase } from "@/features/usePurchases";
import { previewInstallments, previewInstallmentsInProgress, previewRecurringOccurrence } from "@/lib/installmentPreview";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { Purchase } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  purchase?: Purchase | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseFormModal({ open, onClose, purchase }: Props) {
  const isEdit = Boolean(purchase);
  const { data: cards } = useCards();
  const { data: categories } = useCategories();
  const create = useCreatePurchase();
  const update = useUpdatePurchase();

  const [kind, setKind] = useState<"CASH" | "INSTALLMENT" | "RECURRING">("INSTALLMENT");
  const [form, setForm] = useState({
    name: "",
    cardId: "",
    categoryId: "",
    merchant: "",
    notes: "",
    totalAmount: "",
    installmentAmount: "",
    purchaseDate: todayISO(),
    installmentsCount: "2",
    inProgress: false,
    paidInstallmentsCount: "0",
    recurrenceEndDate: "",
    isFavorite: false,
    tags: "",
  });

  useEffect(() => {
    if (purchase) {
      setKind(purchase.kind);
      const firstInstallmentAmount = purchase.installments?.[0]?.amount;
      setForm({
        name: purchase.name,
        cardId: purchase.cardId,
        categoryId: purchase.categoryId ?? "",
        merchant: purchase.merchant ?? "",
        notes: purchase.notes ?? "",
        totalAmount: String(purchase.totalAmount),
        installmentAmount: String(firstInstallmentAmount ?? Number(purchase.totalAmount) / (purchase.installmentsCount || 1)),
        purchaseDate: purchase.purchaseDate.slice(0, 10),
        installmentsCount: String(purchase.installmentsCount),
        inProgress: false,
        paidInstallmentsCount: "0",
        recurrenceEndDate: purchase.recurrenceEndDate ? purchase.recurrenceEndDate.slice(0, 10) : "",
        isFavorite: purchase.isFavorite,
        tags: purchase.tags.join(", "),
      });
    } else if (open) {
      setKind("INSTALLMENT");
      setForm({
        name: "",
        cardId: cards?.[0]?.id ?? "",
        categoryId: "",
        merchant: "",
        notes: "",
        totalAmount: "",
        installmentAmount: "",
        purchaseDate: todayISO(),
        installmentsCount: "2",
        inProgress: false,
        paidInstallmentsCount: "0",
        recurrenceEndDate: "",
        isFavorite: false,
        tags: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchase, open, cards]);

  const selectedCard = cards?.find((c) => c.id === form.cardId);
  /** Assinaturas e parcelamentos já em andamento cobram num dia conhecido direto — sem passar pelo fechamento da fatura. */
  const skipsClosingDay = kind === "RECURRING" || (kind === "INSTALLMENT" && form.inProgress);

  const preview = useMemo(() => {
    if (!selectedCard || kind === "CASH") return [];
    if (kind === "RECURRING") {
      const occurrence = previewRecurringOccurrence({
        nextPaymentDate: new Date(form.purchaseDate + "T12:00:00"),
        monthlyAmount: Number(form.totalAmount) || 0,
      });
      return occurrence ? [occurrence] : [];
    }
    const installmentAmount = Number(form.installmentAmount) || 0;
    const installmentsCount = Number(form.installmentsCount) || 1;
    if (form.inProgress) {
      return previewInstallmentsInProgress({
        nextDueDate: new Date(form.purchaseDate + "T12:00:00"),
        installmentAmount,
        installmentsCount,
        paidInstallmentsCount: Number(form.paidInstallmentsCount) || 0,
      });
    }
    return previewInstallments({
      purchaseDate: new Date(form.purchaseDate + "T12:00:00"),
      closingDay: selectedCard.closingDay,
      dueDay: selectedCard.dueDay,
      installmentAmount,
      installmentsCount,
    });
  }, [
    selectedCard,
    form.purchaseDate,
    form.totalAmount,
    form.installmentAmount,
    form.installmentsCount,
    form.inProgress,
    form.paidInstallmentsCount,
    kind,
  ]);

  const serviceMatch = useMemo(() => (kind === "RECURRING" ? matchServiceIcon(form.name) : null), [kind, form.name]);

  const activeCards = (cards ?? []).filter((c) => (isEdit ? true : c.active));

  const installmentTotal = (Number(form.installmentAmount) || 0) * (Number(form.installmentsCount) || 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name,
      cardId: form.cardId,
      categoryId: form.categoryId || undefined,
      merchant: form.merchant || undefined,
      notes: form.notes || undefined,
      purchaseDate: new Date(form.purchaseDate + "T12:00:00").toISOString(),
      kind,
      isFavorite: form.isFavorite,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    if (kind === "INSTALLMENT") {
      payload.installmentAmount = Number(form.installmentAmount);
      payload.installmentsCount = Number(form.installmentsCount);
      payload.paidInstallmentsCount = form.inProgress ? Number(form.paidInstallmentsCount) || 0 : undefined;
    } else if (kind === "RECURRING") {
      payload.totalAmount = Number(form.totalAmount);
      payload.recurrenceEndDate = form.recurrenceEndDate
        ? new Date(form.recurrenceEndDate + "T12:00:00").toISOString()
        : undefined;
    } else {
      payload.totalAmount = Number(form.totalAmount);
      payload.installmentsCount = 1;
    }

    const onSuccess = () => onClose();
    if (isEdit && purchase) {
      update.mutate(
        { id: purchase.id, data: { name: payload.name, categoryId: payload.categoryId, merchant: payload.merchant, notes: payload.notes, isFavorite: payload.isFavorite, tags: payload.tags } },
        { onSuccess },
      );
    } else {
      create.mutate(payload, { onSuccess });
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar compra" : "Nova compra"} size="xl">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          label="Nome da compra"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={kind === "RECURRING" ? "Ex: Netflix, Spotify" : "Ex: Notebook Dell"}
          required
        />

        <Select
          label="Cartão"
          disabled={isEdit}
          options={activeCards.map((c) => ({
            value: c.id,
            label: skipsClosingDay ? c.name : `${c.name} (fecha dia ${c.closingDay})`,
          }))}
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
          label={kind === "RECURRING" ? "Próximo pagamento" : skipsClosingDay ? "Data da próxima parcela" : "Data da compra"}
          type="date"
          disabled={isEdit}
          value={form.purchaseDate}
          onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
          hint={
            kind === "RECURRING"
              ? "Dia em que essa assinatura cobra no cartão — não a fatura inteira."
              : skipsClosingDay
                ? "Data de vencimento da parcela em aberto mais próxima."
                : undefined
          }
          required
        />

        {kind === "INSTALLMENT" ? (
          <Input
            label="Valor da parcela (R$)"
            type="number"
            step="0.01"
            min="0.01"
            disabled={isEdit}
            value={form.installmentAmount}
            onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
            hint="O valor de cada parcela — sem cálculo de juros, o mesmo número que aparece na fatura."
            required
          />
        ) : (
          <Input
            label={kind === "RECURRING" ? "Valor mensal (R$)" : "Valor total (R$)"}
            type="number"
            step="0.01"
            min="0.01"
            disabled={isEdit}
            value={form.totalAmount}
            onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
            required
          />
        )}

        <div>
          <Label>Tipo de compra</Label>
          <Tabs
            value={kind}
            onChange={(v) => setKind(v as any)}
            options={[
              { value: "CASH", label: "À vista" },
              { value: "INSTALLMENT", label: "Parcelada" },
              // Assinaturas agora nascem em /subscriptions — só aparece aqui pra manter a aba
              // certa selecionada quando se edita uma já existente.
              ...(isEdit && kind === "RECURRING" ? [{ value: "RECURRING", label: "Assinatura" }] : []),
            ]}
          />
          {!isEdit && (
            <p className="mt-1.5 text-xs text-muted">
              Assinatura ou cobrança recorrente? Cadastre em{" "}
              <Link to="/subscriptions" className="text-accent-500 hover:underline" onClick={onClose}>
                Assinaturas
              </Link>
              .
            </p>
          )}
        </div>

        {kind === "INSTALLMENT" && !isEdit && (
          <>
            <Input
              label="Número de parcelas"
              type="number"
              min="2"
              max="48"
              value={form.installmentsCount}
              onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}
            />
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.inProgress}
                onChange={(e) => setForm({ ...form, inProgress: e.target.checked })}
                className="h-4 w-4 rounded accent-accent-500"
              />
              Esse parcelamento já está em andamento
            </label>

            {form.inProgress && (
              <Input
                className="sm:col-span-2"
                label="Parcelas já pagas"
                type="number"
                min="0"
                max={String(Math.max(0, (Number(form.installmentsCount) || 2) - 1))}
                value={form.paidInstallmentsCount}
                onChange={(e) => setForm({ ...form, paidInstallmentsCount: e.target.value })}
                hint="As parcelas já pagas entram automaticamente marcadas como pagas."
              />
            )}
          </>
        )}

        {kind === "RECURRING" && !isEdit && (
          <Input
            className="sm:col-span-2"
            label="Data de término (opcional)"
            type="date"
            min={form.purchaseDate}
            value={form.recurrenceEndDate}
            onChange={(e) => setForm({ ...form, recurrenceEndDate: e.target.value })}
            hint="Deixe em branco para uma assinatura sem prazo — você pode cancelar quando quiser."
          />
        )}

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
          placeholder="Ex: presente, urgente"
        />

        <label className="sm:col-span-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isFavorite}
            onChange={(e) => setForm({ ...form, isFavorite: e.target.checked })}
            className="h-4 w-4 rounded accent-accent-500"
          />
          Marcar como favorita
        </label>

        {!isEdit && kind === "INSTALLMENT" && installmentTotal > 0 && (
          <div className="sm:col-span-2 rounded-2xl surface-2 p-4">
            <p className="text-sm text-muted">
              {form.installmentsCount}x de{" "}
              <span className="font-semibold text-[rgb(var(--text))]">{formatCurrency(Number(form.installmentAmount) || 0)}</span>{" "}
              = total de <span className="font-semibold text-[rgb(var(--text))]">{formatCurrency(installmentTotal)}</span>
            </p>
          </div>
        )}

        {!isEdit && preview.length > 0 && kind !== "RECURRING" && (
          <div className="sm:col-span-2 rounded-2xl surface-2 p-4">
            <p className="mb-2 text-sm font-semibold">
              {preview.length === 1 ? "Cobrança" : `${preview.length} parcelas geradas`}
            </p>
            <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {preview.map((p) => (
                <div key={p.number} className="flex items-center justify-between rounded-lg surface px-3 py-1.5">
                  <span className="text-muted">
                    {preview.length > 1 ? `Parcela ${p.number}/${preview.length}` : "Pagamento único"} · {monthLabel(p.referenceMonth, p.referenceYear, true)}
                  </span>
                  <span className="flex items-center gap-2">
                    {p.status === "PAID" && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        paga
                      </span>
                    )}
                    <span className="font-medium">{formatCurrency(p.amount)}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              {form.inProgress ? "Próxima parcela em aberto" : "Primeiro vencimento"}: {formatDate(preview.find((p) => p.status !== "PAID")?.dueDate ?? preview[0].dueDate)}
            </p>
          </div>
        )}

        {!isEdit && preview.length > 0 && kind === "RECURRING" && (
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
                {formatCurrency(preview[0].amount)} todo mês, a partir de {formatDate(preview[0].dueDate)}
              </p>
              <p className="mt-1 text-muted">
                {form.recurrenceEndDate
                  ? `Cobranças automáticas até ${formatDate(form.recurrenceEndDate + "T12:00:00")}.`
                  : "Cobranças automáticas todo mês, sem data para acabar — cancele quando quiser na lista de compras."}
              </p>
            </div>
          </div>
        )}

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {isEdit ? "Salvar alterações" : "Lançar compra"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
