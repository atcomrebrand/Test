import { useState } from "react";
import { Plus, Receipt, Pencil, Power, MessageSquare, CheckCircle2, Circle, CreditCard as CreditCardIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate, formatCurrency } from "@/lib/format";
import {
  useHouseholdBills,
  useHouseholdBillsMonth,
  useUpdateHouseholdBill,
  useUpdateHouseholdBillEntry,
  useHouseholdCardsMonth,
  useUpdateHouseholdCardEntry,
} from "../api";
import { HouseholdBill, HouseholdBillEntry, HouseholdBillStatus, HouseholdCard, HouseholdCardEntry } from "../types";
import { MonthSwitcher } from "../components/MonthSwitcher";
import { BillFormModal } from "../components/BillFormModal";
import { HouseholdCardFormModal } from "../components/HouseholdCardFormModal";
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

/** Unifies bills (contas fixas) and card invoices (faturas) into one payables list — a fatura
 *  lançada num cartão é, pro usuário, só mais uma conta a pagar do mês. Sorted by day-of-month so
 *  both kinds interleave chronologically instead of showing as two separate blocks. */
type PayableRow = { kind: "BILL"; id: string; sortDay: number; entry: HouseholdBillEntry } | { kind: "CARD"; id: string; sortDay: number; entry: HouseholdCardEntry };

function buildRows(billEntries: HouseholdBillEntry[], cardEntries: HouseholdCardEntry[]): PayableRow[] {
  const billRows: PayableRow[] = billEntries.map((entry) => ({ kind: "BILL", id: entry.id, sortDay: new Date(entry.dueDate).getDate(), entry }));
  const cardRows: PayableRow[] = cardEntries.map((entry) => ({ kind: "CARD", id: entry.id, sortDay: entry.card.dueDay, entry }));
  return [...billRows, ...cardRows].sort((a, b) => a.sortDay - b.sortDay);
}

interface NotesTarget {
  kind: "BILL" | "CARD";
  id: string;
  notes: string | null;
}

export default function Contas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: billEntries, isLoading: loadingBills } = useHouseholdBillsMonth(year, month);
  const { data: cardEntries, isLoading: loadingCards } = useHouseholdCardsMonth(year, month);
  const { data: allBills } = useHouseholdBills();
  const updateBillEntry = useUpdateHouseholdBillEntry();
  const updateCardEntry = useUpdateHouseholdCardEntry();
  const updateBill = useUpdateHouseholdBill();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<HouseholdBill | null>(null);
  const [editingCard, setEditingCard] = useState<HouseholdCard | null>(null);
  const [notesTarget, setNotesTarget] = useState<NotesTarget | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const isLoading = loadingBills || loadingCards;
  const rows = buildRows(billEntries ?? [], cardEntries ?? []);

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

  function openNotes(target: NotesTarget) {
    setNotesTarget(target);
    setNotesDraft(target.notes ?? "");
  }

  function saveNotes() {
    if (!notesTarget) return;
    const mutate = notesTarget.kind === "BILL" ? updateBillEntry.mutate : updateCardEntry.mutate;
    mutate({ id: notesTarget.id, data: { notes: notesDraft } }, { onSuccess: () => setNotesTarget(null) });
  }

  const inactiveBills = (allBills ?? []).filter((b) => !b.active);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contas</h1>
          <p className="text-sm text-muted">Quanto precisa ser pago, quanto já foi reservado, quanto já foi pago — contas fixas e faturas de cartão juntas.</p>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      )}

      {!isLoading && rows.length === 0 && (
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

      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const isBill = row.kind === "BILL";
            const name = isBill ? row.entry.bill.name : row.entry.card.name;
            const dueLabel = isBill ? `Vence dia ${formatDate(row.entry.dueDate, { day: "2-digit", month: "2-digit" })}` : `Vence dia ${row.entry.card.dueDay}`;
            const subtitle = isBill ? row.entry.bill.category?.name : "Cartão de crédito";
            const iconColor = isBill ? row.entry.bill.category?.color ?? "#8B8B8B" : row.entry.card.color;
            const isPaid = isBill ? row.entry.status === "PAID" : row.entry.paid;
            const extraStatus = isBill && row.entry.status !== "PAID" && row.entry.status !== "PENDING" ? row.entry.status : null;

            return (
              <Card key={row.id}>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: iconColor }}>
                        {isBill ? <Receipt className="h-4 w-4" /> : <CreditCardIcon className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-muted">
                          {dueLabel}
                          {subtitle ? ` · ${subtitle}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openNotes({ kind: row.kind, id: row.entry.id, notes: row.entry.notes })}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
                        aria-label="Observações"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => (isBill ? openEdit(row.entry.bill) : setEditingCard(row.entry.card))}
                        className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
                        aria-label="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {extraStatus && <Badge tone={STATUS_TONE[extraStatus]}>{STATUS_LABEL[extraStatus]}</Badge>}

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Valor</span>
                      {isBill ? (
                        <InlineAmountCell
                          value={Number(row.entry.amount)}
                          disabled={!row.entry.bill.allowAmountChange}
                          onSave={(v) => updateBillEntry.mutate({ id: row.entry.id, data: { amount: v } })}
                        />
                      ) : (
                        <InlineAmountCell value={Number(row.entry.totalInvoice)} onSave={(v) => updateCardEntry.mutate({ id: row.entry.id, data: { totalInvoice: v } })} />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted">Reservado</span>
                      {isBill ? (
                        <InlineAmountCell value={Number(row.entry.reservedAmount)} onSave={(v) => updateBillEntry.mutate({ id: row.entry.id, data: { reservedAmount: v } })} />
                      ) : (
                        <InlineAmountCell value={Number(row.entry.provisioned)} onSave={(v) => updateCardEntry.mutate({ id: row.entry.id, data: { provisioned: v } })} />
                      )}
                    </div>
                    {!isBill && (
                      <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3 text-sm font-semibold">
                        <span>Real a pagar</span>
                        <span>{formatCurrency(row.entry.realAmount)}</span>
                      </div>
                    )}
                    <button
                      onClick={() =>
                        isBill
                          ? updateBillEntry.mutate({ id: row.entry.id, data: { paidAmount: isPaid ? 0 : Number(row.entry.amount) } })
                          : updateCardEntry.mutate({ id: row.entry.id, data: { paid: !isPaid } })
                      }
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
                        isPaid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "surface-2 text-muted hover:brightness-95"
                      }`}
                    >
                      {isPaid ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                      {isPaid ? "Paga" : "Marcar como paga"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
      <HouseholdCardFormModal open={!!editingCard} onClose={() => setEditingCard(null)} card={editingCard} />

      <Modal open={!!notesTarget} onClose={() => setNotesTarget(null)} title="Observações da competência" size="sm">
        {notesTarget && (
          <div className="flex flex-col gap-4">
            <Textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={4} autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNotesTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={saveNotes} loading={updateBillEntry.isPending || updateCardEntry.isPending}>
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
