import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import { useCreateRecharge, useCrmPaymentMethods } from "../api";

/**
 * Recarga rápida (§41). Quantidade e pronto — preço e data têm padrão, forma de pagamento é
 * opcional. O total aparece enquanto digita porque é o número que a pessoa confere antes de
 * confirmar, não depois.
 */
export function RechargeModal({
  open,
  onClose,
  linkId,
  nome,
  precoVigente,
}: {
  open: boolean;
  onClose: () => void;
  linkId: string;
  nome: string;
  precoVigente: number;
}) {
  const { data: methods } = useCrmPaymentMethods();
  const create = useCreateRecharge();

  const [quantity, setQuantity] = useState("50");
  const [unitPrice, setUnitPrice] = useState(String(precoVigente));
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setQuantity("50");
      setUnitPrice(String(precoVigente));
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, precoVigente]);

  const total = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  const metodo = methods?.find((m) => m.id === paymentMethodId);
  const taxa = metodo ? (total * Number(metodo.feePercent)) / 100 + Number(metodo.feeFixed) : 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      {
        linkId,
        data: {
          quantity: Number(quantity),
          unitPrice: Number(unitPrice),
          paymentMethodId: paymentMethodId || undefined,
          date: new Date(date).toISOString(),
        },
      },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar recarga">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <p className="text-sm text-muted">{nome}</p>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantidade de créditos"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            autoFocus
          />
          <Input
            label="Valor por crédito"
            type="number"
            step="0.01"
            min="0"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Forma de pagamento"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            options={[
              { value: "", label: "Não informar" },
              ...(methods ?? []).filter((m) => m.active).map((m) => ({ value: m.id, label: m.name })),
            ]}
          />
          <Input label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="surface-2 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Total</span>
            <span className="text-xl font-bold">{formatCurrency(total)}</span>
          </div>
          {taxa > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs text-muted">
              <span>Taxa {metodo?.name}</span>
              <span>
                −{formatCurrency(taxa)} · líquido {formatCurrency(total - taxa)}
              </span>
            </div>
          )}
        </div>

        {/* O preço fica congelado na linha: mudar o preço vigente depois não reprecifica esta
            recarga (§36). Dito na tela porque é a pergunta que aparece meses depois. */}
        {Number(unitPrice) !== precoVigente && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Preço diferente do vigente ({formatCurrency(precoVigente)}). Esta recarga guarda o valor que você digitou
            aqui, e recargas antigas não mudam.
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Confirmar recarga
          </Button>
        </div>
      </form>
    </Modal>
  );
}
