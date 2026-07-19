import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateFinancing, useUpdateFinancing } from "@/features/useFinancings";
import { FINANCING_KIND_OPTIONS } from "@/lib/financingKind";
import { Financing, FinancingKind } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  financing?: Financing | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function FinancingFormModal({ open, onClose, financing }: Props) {
  const isEdit = Boolean(financing);
  const create = useCreateFinancing();
  const update = useUpdateFinancing();

  const [form, setForm] = useState({
    name: "",
    kind: "CAR" as FinancingKind,
    institution: "",
    totalAmount: "",
    installmentAmount: "",
    installmentsCount: "48",
    nextDueDate: todayISO(),
    paidInstallmentsCount: "0",
    payoffAmount: "",
    notes: "",
  });

  useEffect(() => {
    if (financing) {
      setForm({
        name: financing.name,
        kind: financing.kind,
        institution: financing.institution ?? "",
        totalAmount: String(financing.totalAmount),
        installmentAmount: String(financing.installmentAmount),
        installmentsCount: String(financing.installmentsCount),
        nextDueDate: financing.firstDueDate.slice(0, 10),
        paidInstallmentsCount: "0",
        payoffAmount: financing.payoffAmount != null ? String(financing.payoffAmount) : "",
        notes: financing.notes ?? "",
      });
    } else if (open) {
      setForm({
        name: "",
        kind: "CAR",
        institution: "",
        totalAmount: "",
        installmentAmount: "",
        installmentsCount: "48",
        nextDueDate: todayISO(),
        paidInstallmentsCount: "0",
        payoffAmount: "",
        notes: "",
      });
    }
  }, [financing, open]);

  const totalToPay =
    (Number(form.installmentAmount) || 0) * (Number(form.installmentsCount) || 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const onSuccess = () => onClose();

    if (isEdit && financing) {
      update.mutate(
        { id: financing.id, data: { name: form.name, kind: form.kind, institution: form.institution || undefined, notes: form.notes || undefined } },
        { onSuccess },
      );
    } else {
      create.mutate(
        {
          name: form.name,
          kind: form.kind,
          institution: form.institution || undefined,
          totalAmount: Number(form.totalAmount),
          installmentAmount: Number(form.installmentAmount),
          installmentsCount: Number(form.installmentsCount),
          nextDueDate: new Date(form.nextDueDate + "T12:00:00").toISOString(),
          paidInstallmentsCount: Number(form.paidInstallmentsCount) || 0,
          payoffAmount: form.payoffAmount ? Number(form.payoffAmount) : undefined,
          notes: form.notes || undefined,
        },
        { onSuccess },
      );
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar financiamento" : "Novo financiamento"} size="lg">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          label="Nome"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Honda Civic 2024, Apartamento Jardins"
          required
        />

        <Select
          label="Tipo"
          options={FINANCING_KIND_OPTIONS}
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as FinancingKind })}
        />
        <Input
          label="Instituição (opcional)"
          value={form.institution}
          onChange={(e) => setForm({ ...form, institution: e.target.value })}
          placeholder="Ex: Banco Honda, Caixa"
        />

        <Input
          label="Valor total financiado (R$)"
          type="number"
          step="0.01"
          min="0.01"
          disabled={isEdit}
          value={form.totalAmount}
          onChange={(e) => setForm({ ...form, totalAmount: e.target.value })}
          required
        />
        <Input
          label="Valor de cada parcela (R$)"
          type="number"
          step="0.01"
          min="0.01"
          disabled={isEdit}
          value={form.installmentAmount}
          onChange={(e) => setForm({ ...form, installmentAmount: e.target.value })}
          hint="Sem cálculo de juros — use o valor exato que consta no seu contrato."
          required
        />

        <Input
          label="Número de parcelas"
          type="number"
          min="1"
          max="600"
          disabled={isEdit}
          value={form.installmentsCount}
          onChange={(e) => setForm({ ...form, installmentsCount: e.target.value })}
          required
        />
        {!isEdit && (
          <Input
            label="Parcelas já pagas"
            type="number"
            min="0"
            max={String(Math.max(0, (Number(form.installmentsCount) || 1) - 1))}
            value={form.paidInstallmentsCount}
            onChange={(e) => setForm({ ...form, paidInstallmentsCount: e.target.value })}
            hint="0 se o financiamento é novo e ainda não começou a pagar."
          />
        )}

        <Input
          label={Number(form.paidInstallmentsCount) > 0 ? "Data da próxima parcela" : "Data da 1ª parcela"}
          type="date"
          disabled={isEdit}
          value={form.nextDueDate}
          onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
          hint={Number(form.paidInstallmentsCount) > 0 ? "Data de vencimento da próxima parcela em aberto." : undefined}
          required
        />
        {!isEdit && (
          <Input
            className="sm:col-span-2"
            label="Proposta de quitação à vista (R$, opcional)"
            type="number"
            step="0.01"
            min="0"
            value={form.payoffAmount}
            onChange={(e) => setForm({ ...form, payoffAmount: e.target.value })}
            hint="Se o banco já te passou um valor para quitar tudo à vista. Pode ser atualizado depois, sempre que chegar uma nova proposta."
            placeholder="Ex: 18500.00"
          />
        )}

        <Textarea
          className="sm:col-span-2"
          label="Observações"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        {!isEdit && totalToPay > 0 && (
          <div className="rounded-2xl surface-2 p-4 sm:col-span-2">
            <p className="text-sm text-muted">
              {form.installmentsCount}x de{" "}
              <span className="font-semibold text-[rgb(var(--text))]">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(form.installmentAmount) || 0)}
              </span>{" "}
              = total de{" "}
              <span className="font-semibold text-[rgb(var(--text))]">
                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalToPay)}
              </span>{" "}
              a pagar.
            </p>
          </div>
        )}

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {isEdit ? "Salvar alterações" : "Cadastrar financiamento"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
