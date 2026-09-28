import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

interface DangerConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmWord: string;
  confirmLabel: string;
  requirePassword?: boolean;
  loading?: boolean;
  onConfirm: (password?: string) => void;
}

export function DangerConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmWord,
  confirmLabel,
  requirePassword,
  loading,
  onConfirm,
}: DangerConfirmModalProps) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setTyped("");
      setPassword("");
    }
  }, [open]);

  const canConfirm = typed === confirmWord && (!requirePassword || password.length > 0);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm(requirePassword ? password : undefined);
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{description}</p>
        </div>

        {requirePassword && (
          <Input
            label="Confirme sua senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        )}

        <Input
          label={`Digite "${confirmWord}" para confirmar`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoFocus={!requirePassword}
          placeholder={confirmWord}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={!canConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
