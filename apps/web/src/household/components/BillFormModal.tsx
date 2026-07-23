import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateHouseholdBill, useHouseholdBillCategories, useUpdateHouseholdBill } from "../api";
import { HouseholdBill } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  bill?: HouseholdBill | null;
}

export function BillFormModal({ open, onClose, bill }: Props) {
  const { data: categories } = useHouseholdBillCategories();
  const create = useCreateHouseholdBill();
  const update = useUpdateHouseholdBill();
  const isEditing = !!bill;

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [allowAmountChange, setAllowAmountChange] = useState(true);
  const [mandatory, setMandatory] = useState(true);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (bill) {
      setName(bill.name);
      setCategoryId(bill.categoryId ?? "");
      setDueDay(String(bill.dueDay));
      setDefaultAmount(bill.defaultAmount);
      setAllowAmountChange(bill.allowAmountChange);
      setMandatory(bill.mandatory);
      setActive(bill.active);
      setNotes(bill.notes ?? "");
    } else {
      setName("");
      setCategoryId("");
      setDueDay("10");
      setDefaultAmount("");
      setAllowAmountChange(true);
      setMandatory(true);
      setActive(true);
      setNotes("");
    }
  }, [open, bill]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      categoryId: categoryId || null,
      dueDay: Number(dueDay),
      defaultAmount: Number(defaultAmount),
      allowAmountChange,
      mandatory,
      active,
      notes: notes || undefined,
    };

    if (isEditing && bill) {
      update.mutate({ id: bill.id, data: payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = create.isPending || update.isPending;
  const categoryOptions = [{ value: "", label: "Sem categoria" }, ...(categories ?? []).map((c) => ({ value: c.id, label: c.name }))];

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar conta" : "Nova conta"} size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Categoria" options={categoryOptions} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          <Input
            label="Dia do vencimento"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            required
          />
        </div>

        <Input
          label="Valor padrão (R$)"
          type="number"
          step="0.01"
          min="0"
          value={defaultAmount}
          onChange={(e) => setDefaultAmount(e.target.value)}
          hint="Usado ao gerar a competência de cada novo mês."
          required
        />

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allowAmountChange}
              onChange={(e) => setAllowAmountChange(e.target.checked)}
              className="h-4 w-4 rounded accent-amber-500"
            />
            Permite alterar valor no mês
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="h-4 w-4 rounded accent-amber-500"
            />
            Obrigatória
          </label>
          {isEditing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded accent-amber-500"
              />
              Ativa
            </label>
          )}
        </div>

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
