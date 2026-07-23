import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateHouseholdCardEntry } from "../api";
import { HouseholdCard } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  card: HouseholdCard | null;
  year: number;
  month: number;
}

/** Cards aren't auto-generated like Contas — the user launches each month's invoice by hand,
 *  since the total only becomes known once the fatura closes. */
export function CardEntryFormModal({ open, onClose, card, year, month }: Props) {
  const create = useCreateHouseholdCardEntry();
  const [totalInvoice, setTotalInvoice] = useState("");
  const [provisioned, setProvisioned] = useState("");

  useEffect(() => {
    if (open) {
      setTotalInvoice("");
      setProvisioned("");
    }
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!card) return;
    create.mutate(
      { cardId: card.id, year, month, data: { totalInvoice: Number(totalInvoice), provisioned: Number(provisioned || 0) } },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={card ? `Lançar fatura — ${card.name}` : "Lançar fatura"} size="sm">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label="Valor total da fatura (R$)"
          type="number"
          step="0.01"
          min="0"
          value={totalInvoice}
          onChange={(e) => setTotalInvoice(e.target.value)}
          required
          autoFocus
        />
        <Input
          label="Valor provisionado (R$)"
          type="number"
          step="0.01"
          min="0"
          value={provisioned}
          onChange={(e) => setProvisioned(e.target.value)}
          hint="Parte da fatura que já estava prevista/reservada em outra conta (ex: parcelamentos já contabilizados)."
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Lançar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
