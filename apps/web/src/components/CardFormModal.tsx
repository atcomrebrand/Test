import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateCard, useUpdateCard } from "@/features/useCards";
import { CreditCard } from "@/types";

const BRANDS = [
  { value: "VISA", label: "Visa" },
  { value: "MASTERCARD", label: "Mastercard" },
  { value: "ELO", label: "Elo" },
  { value: "AMEX", label: "American Express" },
  { value: "HIPERCARD", label: "Hipercard" },
  { value: "OTHER", label: "Outra" },
];

const COLORS = ["#6D5BFF", "#820AD1", "#EC7000", "#1B1B1B", "#FF7A00", "#0EA5E9", "#16A34A", "#DC2626", "#C026D3"];

interface Props {
  open: boolean;
  onClose: () => void;
  card?: CreditCard | null;
}

export function CardFormModal({ open, onClose, card }: Props) {
  const isEdit = Boolean(card);
  const create = useCreateCard();
  const update = useUpdateCard();

  const [form, setForm] = useState({
    name: "",
    bank: "",
    brand: "VISA",
    color: COLORS[0],
    limitAmount: "",
    lastDigits: "",
    closingDay: "5",
    dueDay: "12",
  });

  useEffect(() => {
    if (card) {
      setForm({
        name: card.name,
        bank: card.bank,
        brand: card.brand,
        color: card.color,
        limitAmount: String(card.limitAmount),
        lastDigits: card.lastDigits,
        closingDay: String(card.closingDay),
        dueDay: String(card.dueDay),
      });
    } else if (open) {
      setForm({ name: "", bank: "", brand: "VISA", color: COLORS[0], limitAmount: "", lastDigits: "", closingDay: "5", dueDay: "12" });
    }
  }, [card, open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const data = {
      name: form.name,
      bank: form.bank,
      brand: form.brand as any,
      color: form.color,
      limitAmount: Number(form.limitAmount),
      lastDigits: form.lastDigits,
      closingDay: Number(form.closingDay),
      dueDay: Number(form.dueDay),
    };

    const onSuccess = () => onClose();
    if (isEdit && card) update.mutate({ id: card.id, data }, { onSuccess });
    else create.mutate(data, { onSuccess });
  }

  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Editar cartão" : "Novo cartão"} size="lg">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          className="sm:col-span-2"
          label="Nome do cartão"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Ex: Nubank Ultravioleta"
          required
        />
        <Input label="Banco" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} required />
        <Select
          label="Bandeira"
          options={BRANDS}
          value={form.brand}
          onChange={(e) => setForm({ ...form, brand: e.target.value })}
        />
        <Input
          label="Limite (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={form.limitAmount}
          onChange={(e) => setForm({ ...form, limitAmount: e.target.value })}
          required
        />
        <Input
          label="Últimos 4 dígitos"
          maxLength={4}
          value={form.lastDigits}
          onChange={(e) => setForm({ ...form, lastDigits: e.target.value.replace(/\D/g, "") })}
          required
        />
        <Select
          label="Dia de fechamento"
          options={days}
          value={form.closingDay}
          onChange={(e) => setForm({ ...form, closingDay: e.target.value })}
        />
        <Select
          label="Dia de vencimento"
          options={days}
          value={form.dueDay}
          onChange={(e) => setForm({ ...form, dueDay: e.target.value })}
        />

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Cor</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--surface))] transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: form.color === c ? `0 0 0 2px ${c}` : undefined }}
                aria-label={c}
              >
                {form.color === c && <span className="block h-full w-full rounded-full border-2 border-white" />}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {isEdit ? "Salvar alterações" : "Adicionar cartão"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
