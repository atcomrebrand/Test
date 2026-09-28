import { Modal } from "@/components/ui/Modal";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/Badge";
import { Check, Undo2, Ban } from "lucide-react";
import {
  usePayFinancingInstallment,
  useUnpayFinancingInstallment,
  useUpdateFinancingInstallmentStatus,
} from "@/features/useFinancings";
import { formatCurrency, formatDate } from "@/lib/format";
import { Financing } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  financing: Financing | null;
}

export function FinancingInstallmentsModal({ open, onClose, financing }: Props) {
  const pay = usePayFinancingInstallment();
  const unpay = useUnpayFinancingInstallment();
  const updateStatus = useUpdateFinancingInstallmentStatus();

  if (!financing) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Parcelas — ${financing.name}`} size="lg">
      <div className="max-h-[65vh] space-y-2 overflow-y-auto">
        {financing.installments.map((inst) => (
          <div key={inst.id} className="flex items-center gap-3 rounded-xl surface-2 px-3 py-2.5">
            <div className="w-14 shrink-0 text-sm font-medium text-muted">
              {inst.number}/{financing.installmentsCount}
            </div>
            <div className="flex-1 text-sm">{formatDate(inst.dueDate)}</div>
            <div className="w-28 text-right font-semibold">{formatCurrency(inst.amount)}</div>
            <Badge tone={STATUS_TONE[inst.status]}>{STATUS_LABEL[inst.status]}</Badge>
            <div className="flex w-16 shrink-0 items-center justify-end gap-1">
              {inst.status === "PAID" ? (
                <button
                  onClick={() => unpay.mutate(inst.id)}
                  className="rounded-lg p-1.5 transition-colors hover:surface"
                  title="Reverter pagamento"
                >
                  <Undo2 className="h-4 w-4 text-muted" />
                </button>
              ) : inst.status === "CANCELLED" ? null : (
                <>
                  <button
                    onClick={() => pay.mutate({ id: inst.id })}
                    className="rounded-lg p-1.5 transition-colors hover:surface"
                    title="Marcar como paga"
                  >
                    <Check className="h-4 w-4 text-emerald-500" />
                  </button>
                  <button
                    onClick={() => updateStatus.mutate({ id: inst.id, status: "CANCELLED" })}
                    className="rounded-lg p-1.5 transition-colors hover:surface"
                    title="Cancelar parcela"
                  >
                    <Ban className="h-4 w-4 text-amber-500" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
