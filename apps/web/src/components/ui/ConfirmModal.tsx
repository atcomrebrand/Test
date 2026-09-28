import { ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
}

/** Lighter than DangerConfirmModal (no typed confirm word) — for actions that deserve a pause and
 *  a clear look at exactly what's about to happen, but aren't destructive enough to need typing a
 *  word to confirm. */
export function ConfirmModal({ open, onClose, title, description, confirmLabel, variant = "primary", loading, onConfirm }: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="text-sm text-muted">{description}</div>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
