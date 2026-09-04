import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCards } from "@/features/useCards";
import { useCreateHouseholdCard, useUpdateHouseholdCard } from "../api";
import { HouseholdCard } from "../types";

const NO_LINK = "";

interface Props {
  open: boolean;
  onClose: () => void;
  card?: HouseholdCard | null;
}

const COLORS = ["#6D5BFF", "#820AD1", "#EC7000", "#1B1B1B", "#FF7A00", "#0EA5E9", "#16A34A", "#DC2626", "#C026D3"];

export function HouseholdCardFormModal({ open, onClose, card }: Props) {
  const create = useCreateHouseholdCard();
  const update = useUpdateHouseholdCard();
  const { data: parcelamentoCards } = useCards();
  const isEditing = !!card;

  const [name, setName] = useState("");
  const [closingDay, setClosingDay] = useState("25");
  const [dueDay, setDueDay] = useState("5");
  const [color, setColor] = useState(COLORS[0]);
  const [active, setActive] = useState(true);
  const [linkedCardId, setLinkedCardId] = useState(NO_LINK);

  useEffect(() => {
    if (!open) return;
    if (card) {
      setName(card.name);
      setClosingDay(String(card.closingDay));
      setDueDay(String(card.dueDay));
      setColor(card.color);
      setActive(card.active);
      setLinkedCardId(card.linkedCardId ?? NO_LINK);
    } else {
      setName("");
      setClosingDay("25");
      setDueDay("5");
      setColor(COLORS[0]);
      setActive(true);
      setLinkedCardId(NO_LINK);
    }
  }, [open, card]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name,
      closingDay: Number(closingDay),
      dueDay: Number(dueDay),
      color,
      linkedCardId: linkedCardId || null,
    };

    if (isEditing && card) {
      update.mutate({ id: card.id, data: { ...payload, active } }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  }

  const isPending = create.isPending || update.isPending;
  const days = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? "Editar cartão" : "Novo cartão"} size="md">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input label="Nome do cartão" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Nubank" required autoFocus />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Dia de fechamento" options={days} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} />
          <Select label="Dia de vencimento" options={days} value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
        </div>

        <Select
          label="Vincular ao cartão do Parcelamento (opcional)"
          options={[{ value: NO_LINK, label: "Nenhum" }, ...(parcelamentoCards ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={linkedCardId}
          onChange={(e) => setLinkedCardId(e.target.value)}
        />

        <div>
          <p className="mb-1.5 text-sm font-medium">Cor</p>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className="h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[rgb(var(--surface))] transition-transform hover:scale-110"
                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        {isEditing && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded accent-amber-500" />
            Ativo
          </label>
        )}

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
