import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateHouseholdIncome, useHouseholdIncomeCategories, useUpdateHouseholdIncome } from "../api";
import { useQuotesTicker } from "@/features/useQuotes";
import { HouseholdIncome } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  income?: HouseholdIncome | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function HouseholdIncomeFormModal({ open, onClose, income }: Props) {
  const { data: categories } = useHouseholdIncomeCategories();
  const { data: quotes } = useQuotesTicker();
  const create = useCreateHouseholdIncome();
  const update = useUpdateHouseholdIncome();
  const isEditing = !!income;

  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isForeignCurrency, setIsForeignCurrency] = useState(false);
  const [grossAmountForeign, setGrossAmountForeign] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [notes, setNotes] = useState("");

  const usdRate = quotes?.find((q) => q.symbol === "USD")?.rate ?? null;

  useEffect(() => {
    if (!open) return;
    if (income) {
      setCategoryId(income.categoryId ?? "");
      setDate(income.date.slice(0, 10));
      setDescription(income.description ?? "");
      setAmount(income.amount);
      setIsForeignCurrency(income.isForeignCurrency);
      setGrossAmountForeign(income.grossAmountForeign ?? "");
      setExchangeRate(income.exchangeRate ?? "");
      setNotes(income.notes ?? "");
    } else {
      setCategoryId("");
      setDate(todayISO());
      setDescription("");
      setAmount("");
      setIsForeignCurrency(false);
      setGrossAmountForeign("");
      setExchangeRate(usdRate ? String(usdRate) : "");
      setNotes("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, income]);

  function toggleForeign(checked: boolean) {
    setIsForeignCurrency(checked);
    if (checked && !exchangeRate && usdRate) setExchangeRate(String(usdRate));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      categoryId: categoryId || null,
      date: new Date(date + "T12:00:00").toISOString(),
      description: description || undefined,
      amount: Number(amount),
      isForeignCurrency,
      notes: notes || undefined,
    };
    if (isForeignCurrency) {
      payload.grossAmountForeign = Number(grossAmountForeign);
      payload.exchangeRate = Number(exchangeRate);
    }

    if (isEditing && income) {
      update.mutate({ id: income.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = create.isPending || update.isPending;
  const categoryOptions = [{ value: "", label: "Sem categoria" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar entrada" : "Nova entrada"} size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Categoria" options={categoryOptions} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <Input label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />

        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl surface-2 p-3">
          <div>
            <p className="text-sm font-medium">Dinheiro Gringo?</p>
            <p className="text-xs text-muted">Entrada recebida em dólar — guarda o valor bruto e a cotação como referência, além do valor em reais.</p>
          </div>
          <input
            type="checkbox"
            checked={isForeignCurrency}
            onChange={(e) => toggleForeign(e.target.checked)}
            className="h-5 w-5 shrink-0 rounded accent-accent-500"
          />
        </label>

        {isForeignCurrency && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Total Bruto (US$)"
              type="number"
              step="0.01"
              min="0"
              value={grossAmountForeign}
              onChange={(e) => setGrossAmountForeign(e.target.value)}
              required
            />
            <Input
              label="Cotação do dólar (na hora do pagamento)"
              type="number"
              step="0.0001"
              min="0"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              required
            />
          </div>
        )}

        <Input label="Valor (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />

        <Textarea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEditing ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
