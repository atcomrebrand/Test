import { useState } from "react";
import { Plus, Receipt, Pencil, Power, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import { useHouseholdBills, useHouseholdBillsMonth, useUpdateHouseholdBill, useUpdateHouseholdBillEntry } from "../api";
import { HouseholdBill, HouseholdBillEntry, HouseholdBillStatus } from "../types";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { BillFormModal } from "../components/BillFormModal";
import { InlineAmountCell } from "../components/InlineAmountCell";

const STATUS_TONE: Record<HouseholdBillStatus, "neutral" | "success" | "warning" | "danger" | "accent"> = {
  PENDING: "neutral",
  PARTIALLY_RESERVED: "warning",
  RESERVED: "accent",
  PAID: "success",
  LATE: "danger",
};

const STATUS_LABEL: Record<HouseholdBillStatus, string> = {
  PENDING: "Pendente",
  PARTIALLY_RESERVED: "Parcial. reservado",
  RESERVED: "Reservado",
  PAID: "Pago",
  LATE: "Atrasado",
};

export default function Contas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: entries, isLoading } = useHouseholdBillsMonth(year, month);
  const { data: allBills } = useHouseholdBills();
  const updateEntry = useUpdateHouseholdBillEntry();
  const updateBill = useUpdateHouseholdBill();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<HouseholdBill | null>(null);
  const [notesEntry, setNotesEntry] = useState<HouseholdBillEntry | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  function openCreate() {
    setEditingBill(null);
    setFormOpen(true);
  }

  function openEdit(bill: HouseholdBill) {
    setEditingBill(bill);
    setFormOpen(true);
  }

  function toggleActive(bill: HouseholdBill) {
    updateBill.mutate({ id: bill.id, data: { active: !bill.active } });
  }

  function openNotes(entry: HouseholdBillEntry) {
    setNotesEntry(entry);
    setNotesDraft(entry.notes ?? "");
  }

  function saveNotes() {
    if (!notesEntry) return;
    updateEntry.mutate({ id: notesEntry.id, data: { notes: notesDraft } }, { onSuccess: () => setNotesEntry(null) });
  }

  const inactiveBills = (allBills ?? []).filter((b) => !b.active);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas</h1>
          <p className="text-sm text-muted">Quanto precisa ser pago, quanto já foi reservado, quanto já foi pago.</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSwitcher year={year} month={month} onChange={(y, m) => (setYear(y), setMonth(m))} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nova conta
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {!isLoading && (!entries || entries.length === 0) && (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas fixas (aluguel, luz, água, internet...) pra acompanhar mês a mês."
          action={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Cadastrar conta
            </Button>
          }
        />
      )}

      {!isLoading && entries && entries.length > 0 && (
        <>
          {/* Mobile: card list */}
          <div className="flex flex-col gap-2 sm:hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="rounded-2xl surface border border-[rgb(var(--border))] p-4 shadow-soft">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{entry.bill.name}</p>
                    <p className="text-xs text-muted">Vence dia {formatDate(entry.dueDate, { day: "2-digit", month: "2-digit" })}</p>
                  </div>
                  <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-muted">Valor</p>
                    <InlineAmountCell
                      value={Number(entry.amount)}
                      disabled={!entry.bill.allowAmountChange}
                      onSave={(v) => updateEntry.mutate({ id: entry.id, data: { amount: v } })}
                    />
                  </div>
                  <div>
                    <p className="text-muted">Reservado</p>
                    <InlineAmountCell value={Number(entry.reservedAmount)} onSave={(v) => updateEntry.mutate({ id: entry.id, data: { reservedAmount: v } })} />
                  </div>
                  <div>
                    <p className="text-muted">Pago</p>
                    <InlineAmountCell value={Number(entry.paidAmount)} onSave={(v) => updateEntry.mutate({ id: entry.id, data: { paidAmount: v } })} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-[rgb(var(--border))] pt-2">
                  <button onClick={() => openNotes(entry)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Observações">
                    <MessageSquare className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEdit(entry.bill)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: inline-editable table */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[rgb(var(--border))] sm:block">
            <table className="w-full text-sm">
              <thead className="surface-2 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-right font-medium">Reservado</th>
                  <th className="px-4 py-3 text-right font-medium">Pago</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="surface divide-y divide-[rgb(var(--border))]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:surface-2">
                    <td className="px-4 py-3">
                      <p className="font-medium">{entry.bill.name}</p>
                      {entry.bill.category && <p className="text-xs text-muted">{entry.bill.category.name}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDate(entry.dueDate, { day: "2-digit", month: "2-digit" })}</td>
                    <td className="px-4 py-3 text-right">
                      <InlineAmountCell
                        value={Number(entry.amount)}
                        disabled={!entry.bill.allowAmountChange}
                        onSave={(v) => updateEntry.mutate({ id: entry.id, data: { amount: v } })}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InlineAmountCell value={Number(entry.reservedAmount)} onSave={(v) => updateEntry.mutate({ id: entry.id, data: { reservedAmount: v } })} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <InlineAmountCell value={Number(entry.paidAmount)} onSave={(v) => updateEntry.mutate({ id: entry.id, data: { paidAmount: v } })} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openNotes(entry)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Observações">
                          <MessageSquare className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(entry.bill)} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {inactiveBills.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">Contas inativas</p>
          <div className="flex flex-col gap-2">
            {inactiveBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl surface border border-[rgb(var(--border))] px-4 py-2.5 opacity-70">
                <p className="text-sm">{bill.name}</p>
                <button onClick={() => toggleActive(bill)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:surface-2">
                  <Power className="h-3.5 w-3.5" />
                  Reativar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <BillFormModal open={formOpen} onClose={() => setFormOpen(false)} bill={editingBill} />

      <Modal open={!!notesEntry} onClose={() => setNotesEntry(null)} title="Observações da competência" size="sm">
        <div className="flex flex-col gap-4">
          <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={4} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNotesEntry(null)}>
              Cancelar
            </Button>
            <Button onClick={saveNotes} loading={updateEntry.isPending}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
