import { useState, useRef, ReactNode } from "react";
import {
  Plus,
  Receipt,
  Pencil,
  Power,
  Trash2,
  MessageSquare,
  CheckCircle2,
  Circle,
  CreditCard as CreditCardIcon,
  PiggyBank,
  Banknote,
  CalendarOff,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { formatDate, formatCurrency, parseAmountInput } from "@/lib/format";
import {
  useHouseholdBills,
  useHouseholdBillsMonth,
  useUpdateHouseholdBill,
  useUpdateHouseholdBillEntry,
  useDeleteHouseholdBill,
  useReorderHouseholdBills,
  useHouseholdCards,
  useHouseholdCardsMonth,
  useUpdateHouseholdCard,
  useUpdateHouseholdCardEntry,
  useDeleteHouseholdCard,
  useReorderHouseholdCards,
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
  SKIPPED: "neutral",
};

const STATUS_LABEL: Record<HouseholdBillStatus, string> = {
  PENDING: "Pendente",
  PARTIALLY_RESERVED: "Parcial. reservado",
  RESERVED: "Reservado",
  PAID: "Pago",
  LATE: "Atrasado",
  SKIPPED: "Não precisou pagar",
};

/** Unifies bills (contas fixas) and card invoices (faturas) into one payables list — a fatura
 *  lançada num cartão é, pro usuário, só mais uma conta a pagar do mês. Order comes straight from
 *  the API (bill/card.order, set by dragging in each accordion section), never re-sorted here —
 *  re-sorting by due date on every render is what made cards "jump" after an edit. */
type PayableRow = { kind: "BILL"; id: string; entry: HouseholdBillEntry } | { kind: "CARD"; id: string; entry: HouseholdCardEntry };

function buildRows(billEntries: HouseholdBillEntry[], cardEntries: HouseholdCardEntry[]): PayableRow[] {
  const billRows: PayableRow[] = billEntries.map((entry) => ({ kind: "BILL", id: entry.id, entry }));
  const cardRows: PayableRow[] = cardEntries.map((entry) => ({ kind: "CARD", id: entry.id, entry }));
  return [...billRows, ...cardRows];
}

interface NotesTarget {
  kind: "BILL" | "CARD";
  id: string;
  notes: string | null;
}

interface DeleteTarget {
  kind: "BILL" | "CARD";
  id: string;
  name: string;
  active: boolean;
}

interface PayLessTarget {
  id: string;
  amount: number;
  current: number;
}

/** A collapsible group ("Contas da casa" / "Faturas de cartão") — same rows as before, just
 *  organized under a header you can close instead of one long flat grid. */
function AccordionSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <button onClick={onToggle} className="flex w-full items-center justify-between rounded-xl surface border border-[rgb(var(--border))] px-4 py-3 text-left transition-colors hover:surface-2">
        <span className="flex items-center gap-2 font-semibold">
          {title}
          <Badge tone="neutral">{count}</Badge>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
      </button>
      {open &&
        (count > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
        ) : (
          <p className="px-1 text-sm text-muted">Nada por aqui neste mês.</p>
        ))}
    </div>
  );
}

interface BillEntryUpdate {
  amount?: number;
  reservedAmount?: number;
  paidAmount?: number;
  skipped?: boolean;
}

interface CardEntryUpdate {
  totalInvoice?: number;
  provisioned?: number;
  paid?: boolean;
}

/** One payable — a conta comum or a fatura de cartão. Contas comuns get 3 uniform action buttons
 *  instead of a typed "reservado" field: presuming the full amount when reserving/paying means
 *  there's nothing to type for the common case, only "paguei menos" opens a value input. */
function PayableCardView({
  row,
  onOpenNotes,
  onEdit,
  onDelete,
  onUpdateBillEntry,
  onUpdateCardEntry,
  onOpenPayLess,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  row: PayableRow;
  onOpenNotes: (t: NotesTarget) => void;
  onEdit: () => void;
  onDelete: () => void;
  onUpdateBillEntry: (data: BillEntryUpdate) => void;
  onUpdateCardEntry: (data: CardEntryUpdate) => void;
  onOpenPayLess: (id: string, amount: number, current: number) => void;
  isDragging: boolean;
  isDropTarget: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onTouchStart: () => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}) {
  const isBill = row.kind === "BILL";
  const name = isBill ? row.entry.bill.name : row.entry.card.name;
  const dueLabel = isBill ? `Vence dia ${formatDate(row.entry.dueDate, { day: "2-digit", month: "2-digit" })}` : `Vence dia ${row.entry.card.dueDay}`;
  const subtitle = isBill ? row.entry.bill.category?.name : "Cartão de crédito";
  const iconColor = isBill ? row.entry.bill.category?.color ?? "#8B8B8B" : row.entry.card.color;
  const isCardPaid = !isBill && row.entry.paid;
  const extraStatus = isBill && row.entry.status !== "PAID" && row.entry.status !== "PENDING" ? row.entry.status : null;

  const billAmount = isBill ? Number(row.entry.amount) : 0;
  const billPaidAmount = isBill ? Number(row.entry.paidAmount) : 0;
  const billReservedAmount = isBill ? Number(row.entry.reservedAmount) : 0;
  const isSkipped = isBill && row.entry.skipped;
  const isPaidFull = isBill && row.entry.status === "PAID";
  const isReservedFull = isBill && billAmount > 0 && billReservedAmount >= billAmount;
  const isPaidPartial = isBill && billPaidAmount > 0 && billPaidAmount < billAmount;

  return (
    <Card
      data-row-id={row.id}
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab transition-[opacity,box-shadow] active:cursor-grabbing",
        isDragging && "opacity-40",
        isDropTarget && "ring-2 ring-amber-500",
      )}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="touch-none cursor-grab p-1 active:cursor-grabbing"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              aria-label="Arrastar para reordenar"
              role="button"
            >
              <GripVertical className="h-4 w-4 shrink-0 text-muted" />
            </span>
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
              onClick={() => onOpenNotes({ kind: row.kind, id: row.entry.id, notes: row.entry.notes })}
              className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
              aria-label="Observações"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button onClick={onEdit} className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2" aria-label="Editar">
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={onDelete} className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500" aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {extraStatus && <Badge tone={STATUS_TONE[extraStatus]}>{STATUS_LABEL[extraStatus]}</Badge>}

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Valor</span>
            {isBill ? (
              <InlineAmountCell value={billAmount} disabled={!row.entry.bill.allowAmountChange} onSave={(v) => onUpdateBillEntry({ amount: v })} />
            ) : (
              <InlineAmountCell value={Number(row.entry.totalInvoice)} onSave={(v) => onUpdateCardEntry({ totalInvoice: v })} />
            )}
          </div>

          {!isBill && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Reservado</span>
              <InlineAmountCell value={Number(row.entry.provisioned)} onSave={(v) => onUpdateCardEntry({ provisioned: v })} />
            </div>
          )}
          {!isBill && (
            <div className="flex items-center justify-between border-t border-[rgb(var(--border))] pt-3 text-sm font-semibold">
              <span>Real a pagar</span>
              <span>{formatCurrency(row.entry.realAmount)}</span>
            </div>
          )}

          {isBill ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateBillEntry({ paidAmount: isPaidFull ? 0 : billAmount })}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                  isPaidFull ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "surface-2 text-muted hover:brightness-95"
                }`}
              >
                {isPaidFull ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {isPaidFull ? "Pago" : "Marcar como pago"}
              </button>
              <button
                onClick={() => onUpdateBillEntry({ reservedAmount: isReservedFull ? 0 : billAmount })}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                  isReservedFull ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "surface-2 text-muted hover:brightness-95"
                }`}
              >
                <PiggyBank className="h-4 w-4" />
                {isReservedFull ? "Reservado" : "Dinheiro reservado"}
              </button>
              <button
                onClick={() => onOpenPayLess(row.entry.id, billAmount, billPaidAmount)}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                  isPaidPartial ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "surface-2 text-muted hover:brightness-95"
                }`}
              >
                <Banknote className="h-4 w-4" />
                {isPaidPartial ? `Paguei ${formatCurrency(billPaidAmount)}` : "Paguei menos"}
              </button>
              <button
                onClick={() => onUpdateBillEntry({ skipped: !isSkipped })}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center text-xs font-medium leading-tight transition-colors ${
                  isSkipped ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "surface-2 text-muted hover:brightness-95"
                }`}
              >
                <CalendarOff className="h-4 w-4" />
                {isSkipped ? "Não precisou pagar" : "Não precisou pagar esse mês"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => onUpdateCardEntry({ paid: !isCardPaid })}
              className={`flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-colors ${
                isCardPaid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "surface-2 text-muted hover:brightness-95"
              }`}
            >
              {isCardPaid ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
              {isCardPaid ? "Paga" : "Marcar como paga"}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Contas() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: billEntries, isLoading: loadingBills } = useHouseholdBillsMonth(year, month);
  const { data: cardEntries, isLoading: loadingCards } = useHouseholdCardsMonth(year, month);
  const { data: allBills } = useHouseholdBills();
  const { data: allCards } = useHouseholdCards();
  const updateBillEntry = useUpdateHouseholdBillEntry();
  const updateCardEntry = useUpdateHouseholdCardEntry();
  const updateBill = useUpdateHouseholdBill();
  const updateCard = useUpdateHouseholdCard();
  const deleteBill = useDeleteHouseholdBill();
  const deleteCard = useDeleteHouseholdCard();
  const reorderBills = useReorderHouseholdBills(year, month);
  const reorderCards = useReorderHouseholdCards(year, month);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<HouseholdBill | null>(null);
  const [editingCard, setEditingCard] = useState<HouseholdCard | null>(null);
  const [notesTarget, setNotesTarget] = useState<NotesTarget | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [payLessTarget, setPayLessTarget] = useState<PayLessTarget | null>(null);
  const [payLessDraft, setPayLessDraft] = useState("");
  const [openSections, setOpenSections] = useState({ bills: true, cards: true });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedKind, setDraggedKind] = useState<"BILL" | "CARD" | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  /** Touch gestures fire touchmove/touchend faster than React necessarily re-renders between
   *  them, so the state above (used only for visual feedback) can lag a frame behind — these
   *  refs are the actual source of truth the touch handlers read from, always in sync. */
  const draggedIdRef = useRef<string | null>(null);
  const draggedKindRef = useRef<"BILL" | "CARD" | null>(null);
  const dragOverIdRef = useRef<string | null>(null);

  const isLoading = loadingBills || loadingCards;
  const rows = buildRows(billEntries ?? [], cardEntries ?? []);
  const billRows = rows.filter((r): r is Extract<PayableRow, { kind: "BILL" }> => r.kind === "BILL");
  const cardRows = rows.filter((r): r is Extract<PayableRow, { kind: "CARD" }> => r.kind === "CARD");

  function openCreate() {
    setEditingBill(null);
    setFormOpen(true);
  }

  function openEdit(bill: HouseholdBill) {
    setEditingBill(bill);
    setFormOpen(true);
  }

  function setActive(target: { kind: "BILL" | "CARD"; id: string }, active: boolean) {
    if (target.kind === "BILL") updateBill.mutate({ id: target.id, data: { active } });
    else updateCard.mutate({ id: target.id, data: { active } });
  }

  function openDeleteDialog(target: DeleteTarget) {
    setDeleteTarget(target);
  }

  function keepHistoryAndDeactivate() {
    if (!deleteTarget) return;
    setActive(deleteTarget, false);
    setDeleteTarget(null);
  }

  function eraseEverything() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "BILL") deleteBill.mutate(deleteTarget.id);
    else deleteCard.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }

  function toggleSection(key: "bills" | "cards") {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }

  function handleDragStart(kind: "BILL" | "CARD", rowId: string) {
    draggedIdRef.current = rowId;
    draggedKindRef.current = kind;
    setDraggedId(rowId);
    setDraggedKind(kind);
  }

  function handleDragEnd() {
    draggedIdRef.current = null;
    draggedKindRef.current = null;
    dragOverIdRef.current = null;
    setDraggedId(null);
    setDraggedKind(null);
    setDragOverId(null);
  }

  /** Touch devices don't fire HTML5 drag events at all, so dragging on mobile is done by hand:
   *  the grip handle owns the touch gesture (touch-action: none keeps the page from scrolling
   *  under it), and on every move we look up whatever row is currently under the finger via
   *  elementFromPoint — touchmove keeps targeting the handle itself, never the element below it.
   *  Reads/writes the refs (not the mirrored state) because touchmove/touchend can fire faster
   *  than React re-renders, and a stale closure over last render's state would silently no-op. */
  function handleTouchMove(e: React.TouchEvent) {
    if (!draggedIdRef.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const rowEl = el?.closest("[data-row-id]");
    const targetId = rowEl?.getAttribute("data-row-id") ?? null;
    dragOverIdRef.current = targetId;
    setDragOverId(targetId);
  }

  function handleTouchEnd() {
    const kind = draggedKindRef.current;
    const targetId = dragOverIdRef.current;
    if (kind && targetId) handleDrop(kind, targetId);
    else handleDragEnd();
  }

  /** Only rows of the same kind ever produce a valid drop — dragging a bill card over the cartões
   *  section just finds no match in cardRows and silently no-ops, so no explicit kind check needed. */
  function handleDrop(kind: "BILL" | "CARD", targetRowId: string) {
    const sourceId = draggedIdRef.current;
    if (sourceId && sourceId !== targetRowId) {
      const rows = kind === "BILL" ? billRows : cardRows;
      const fromIndex = rows.findIndex((r) => r.id === sourceId);
      const toIndex = rows.findIndex((r) => r.id === targetRowId);
      if (fromIndex !== -1 && toIndex !== -1) {
        const reordered: PayableRow[] = [...rows];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        const ids = reordered.map((r) => (r.kind === "BILL" ? r.entry.bill.id : r.entry.card.id));
        if (kind === "BILL") reorderBills.mutate(ids);
        else reorderCards.mutate(ids);
      }
    }
    draggedIdRef.current = null;
    draggedKindRef.current = null;
    dragOverIdRef.current = null;
    setDraggedId(null);
    setDraggedKind(null);
    setDragOverId(null);
  }

  function openPayLess(id: string, amount: number, current: number) {
    setPayLessTarget({ id, amount, current });
    setPayLessDraft(current > 0 && current < amount ? String(current) : "");
  }

  function confirmPayLess() {
    if (!payLessTarget) return;
    const parsed = parseAmountInput(payLessDraft);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      updateBillEntry.mutate({ id: payLessTarget.id, data: { paidAmount: parsed } });
    }
    setPayLessTarget(null);
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
  const inactiveCards = (allCards ?? []).filter((c) => !c.active);

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
        <div className="flex flex-col gap-4">
          <AccordionSection title="Contas da casa" count={billRows.length} open={openSections.bills} onToggle={() => toggleSection("bills")}>
            {billRows.map((row) => (
              <PayableCardView
                key={row.id}
                row={row}
                onOpenNotes={openNotes}
                onEdit={() => openEdit(row.entry.bill)}
                onDelete={() => openDeleteDialog({ kind: "BILL", id: row.entry.bill.id, name: row.entry.bill.name, active: true })}
                onUpdateBillEntry={(data) => updateBillEntry.mutate({ id: row.entry.id, data })}
                onUpdateCardEntry={() => {}}
                onOpenPayLess={openPayLess}
                isDragging={draggedId === row.id}
                isDropTarget={dragOverId === row.id && draggedId !== row.id}
                onDragStart={() => handleDragStart("BILL", row.id)}
                onDragOver={() => setDragOverId(row.id)}
                onDragLeave={() => setDragOverId((cur) => (cur === row.id ? null : cur))}
                onDrop={() => handleDrop("BILL", row.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={() => handleDragStart("BILL", row.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            ))}
          </AccordionSection>

          <AccordionSection title="Faturas de cartão" count={cardRows.length} open={openSections.cards} onToggle={() => toggleSection("cards")}>
            {cardRows.map((row) => (
              <PayableCardView
                key={row.id}
                row={row}
                onOpenNotes={openNotes}
                onEdit={() => setEditingCard(row.entry.card)}
                onDelete={() => openDeleteDialog({ kind: "CARD", id: row.entry.card.id, name: row.entry.card.name, active: true })}
                onUpdateBillEntry={() => {}}
                onUpdateCardEntry={(data) => updateCardEntry.mutate({ id: row.entry.id, data })}
                onOpenPayLess={openPayLess}
                isDragging={draggedId === row.id}
                isDropTarget={dragOverId === row.id && draggedId !== row.id}
                onDragStart={() => handleDragStart("CARD", row.id)}
                onDragOver={() => setDragOverId(row.id)}
                onDragLeave={() => setDragOverId((cur) => (cur === row.id ? null : cur))}
                onDrop={() => handleDrop("CARD", row.id)}
                onDragEnd={handleDragEnd}
                onTouchStart={() => handleDragStart("CARD", row.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              />
            ))}
          </AccordionSection>
        </div>
      )}

      {(inactiveBills.length > 0 || inactiveCards.length > 0) && (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">Contas e cartões inativos</p>
          <div className="flex flex-col gap-2">
            {inactiveBills.map((bill) => (
              <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl surface border border-[rgb(var(--border))] px-4 py-2.5 opacity-70">
                <p className="text-sm">{bill.name}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActive({ kind: "BILL", id: bill.id }, true)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:surface-2"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Reativar
                  </button>
                  <button
                    onClick={() => openDeleteDialog({ kind: "BILL", id: bill.id, name: bill.name, active: false })}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            {inactiveCards.map((card) => (
              <div key={card.id} className="flex items-center justify-between gap-3 rounded-xl surface border border-[rgb(var(--border))] px-4 py-2.5 opacity-70">
                <p className="text-sm">{card.name}</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActive({ kind: "CARD", id: card.id }, true)}
                    className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:surface-2"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Reativar
                  </button>
                  <button
                    onClick={() => openDeleteDialog({ kind: "CARD", id: card.id, name: card.name, active: false })}
                    className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
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

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={deleteTarget ? `Excluir "${deleteTarget.name}"?` : ""} size="sm">
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">
              {deleteTarget.active
                ? "Você pode manter o histórico de valores e pagamentos já lançados (desativando, sem apagar nada), ou apagar tudo definitivamente."
                : "Isso apaga a conta e todo o histórico de valores e pagamentos já lançados pra ela, sem volta."}
            </p>
            <div className="flex flex-col gap-2">
              {deleteTarget.active && (
                <Button variant="secondary" onClick={keepHistoryAndDeactivate} loading={updateBill.isPending || updateCard.isPending}>
                  Manter histórico e desativar
                </Button>
              )}
              <Button variant="danger" onClick={eraseEverything} loading={deleteBill.isPending || deleteCard.isPending}>
                <Trash2 className="h-4 w-4" />
                Apagar tudo, sem volta
              </Button>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!payLessTarget} onClose={() => setPayLessTarget(null)} title="Quanto você pagou?" size="sm">
        {payLessTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">Valor da conta: {formatCurrency(payLessTarget.amount)}</p>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
              value={payLessDraft}
              onChange={(e) => setPayLessDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmPayLess()}
              className="h-10 w-full rounded-lg border border-[rgb(var(--border))] surface px-3 text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPayLessTarget(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmPayLess} loading={updateBillEntry.isPending} disabled={Number.isNaN(parseAmountInput(payLessDraft))}>
                Salvar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
