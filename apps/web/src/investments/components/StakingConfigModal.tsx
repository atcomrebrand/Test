import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUpdateAsset } from "../api";
import { InvestmentAsset } from "../types";

interface Props {
  asset: InvestmentAsset | null;
  onClose: () => void;
}

export function StakingConfigModal({ asset, onClose }: Props) {
  const updateAsset = useUpdateAsset();
  const [apy, setApy] = useState("");

  useEffect(() => {
    if (asset) setApy(asset.stakingApyPercent ?? "");
  }, [asset]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!asset) return;
    updateAsset.mutate(
      { id: asset.id, data: { stakingApyPercent: apy === "" ? null : Number(apy) } },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal open={!!asset} onClose={onClose} title={`Staking de ${asset?.ticker ?? ""}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Cada corretora oferece uma taxa de staking diferente pra {asset?.ticker} — configure aqui a taxa que a sua
          corretora paga hoje. É só uma estimativa: pra registrar um rendimento de staking que você recebeu de
          verdade, use o botão "Provento".
        </p>
        <Input
          label="APY de staking (% a.a.)"
          type="number"
          step="0.01"
          min="0"
          placeholder="Ex: 8.5"
          value={apy}
          onChange={(e) => setApy(e.target.value)}
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={updateAsset.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
