import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateTrackingIncome, useUpdateTrackingIncome } from "../api";
import { TrackingIncome } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  income?: TrackingIncome | null;
}

const CATEGORY_OPTIONS = [
  { value: "DIVIDENDO", label: "Dividendos" },
  { value: "VENDA", label: "Venda" },
  { value: "BONIFICACAO", label: "Bonificação" },
  { value: "CASHBACK", label: "Cashback" },
  { value: "REEMBOLSO", label: "Reembolso" },
  { value: "PRESENTE", label: "Presente" },
  { value: "OUTRO", label: "Outro" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function IncomeFormModal({ open, onClose, income }: Props) {
  const create = useCreateTrackingIncome();
  const update = useUpdateTrackingIncome();
  const isEditing = !!income;

  const [name, setName] = useState("");
  const [category, setCategory] = useState("OUTRO");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (income) {
      setName(income.name);
      setCategory(income.category);
      setAmount(income.amount);
      setDate(income.date.slice(0, 10));
      setNotes(income.notes ?? "");
    } else {
      setName("");
      setCategory("OUTRO");
      setAmount("");
      setDate(todayISO());
      setNotes("");
    }
  }, [open, income]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      category,
      amount: Number(amount),
      date: new Date(date + "T12:00:00").toISOString(),
      notes: notes || undefined,
    };

    if (isEditing && income) {
      update.mutate({ id: income.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar entrada" : "Nova entrada"} size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Categoria" options={CATEGORY_OPTIONS} value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Valor (R$)" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>

        <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

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
