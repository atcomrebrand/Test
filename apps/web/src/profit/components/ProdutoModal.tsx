import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSaveProduct } from "../api";
import { ProfitProductDetail } from "../types";

/** Só o que é do PRODUTO entra aqui. Taxa é do canal — pedir as duas no mesmo formulário faria
 *  cadastrar o mesmo produto uma vez por lugar onde ele é vendido. */
export function ProdutoModal({
  open,
  onClose,
  produto,
}: {
  open: boolean;
  onClose: () => void;
  /** Quando vem, o modal edita em vez de criar. */
  produto?: ProfitProductDetail["product"] | null;
}) {
  const salvar = useSaveProduct();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [cost, setCost] = useState("");
  const [packagingCost, setPackaging] = useState("");
  const [extraCost, setExtra] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(produto?.name ?? "");
    setSku(produto?.sku ?? "");
    setCost(produto ? String(produto.cost) : "");
    setPackaging(produto ? String(produto.packagingCost) : "");
    setExtra(produto ? String(produto.extraCost) : "");
    setNotes(produto?.notes ?? "");
  }, [open, produto]);

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")) || 0);

  function submit() {
    salvar.mutate(
      {
        id: produto?.id,
        data: {
          name: name.trim(),
          sku: sku.trim() || undefined,
          cost: num(cost),
          packagingCost: num(packagingCost),
          extraCost: num(extraCost),
          notes: notes.trim() || undefined,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={produto ? "Editar produto" : "Novo produto"}>
      <div className="flex flex-col gap-4">
        <Input id="profit-product-name" label="Nome" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Input label="SKU (opcional)" value={sku} onChange={(e) => setSku(e.target.value)} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Custo (R$)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          <Input label="Embalagem (R$)" inputMode="decimal" value={packagingCost} onChange={(e) => setPackaging(e.target.value)} />
          <Input label="Outros (R$)" inputMode="decimal" value={extraCost} onChange={(e) => setExtra(e.target.value)} />
        </div>
        <Textarea label="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!name.trim()} loading={salvar.isPending} onClick={submit}>
            {produto ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
