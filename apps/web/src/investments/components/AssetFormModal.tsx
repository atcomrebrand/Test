import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateAsset } from "../api";
import { AssetClass } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  assetClass: AssetClass;
}

const CLASS_LABEL: Record<AssetClass, string> = { STOCK: "ação", FII: "FII", CRYPTO: "criptomoeda" };

export function AssetFormModal({ open, onClose, assetClass }: Props) {
  const create = useCreateAsset();
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState("");

  function reset() {
    setTicker("");
    setBroker("");
    setWallet("");
    setNetwork("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      { class: assetClass, ticker, broker: broker || undefined, wallet: wallet || undefined, network: network || undefined },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={`Nova ${CLASS_LABEL[assetClass]}`}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Input
          label={assetClass === "CRYPTO" ? "Moeda (ex: BTC)" : "Ticker (ex: PETR4)"}
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          required
          autoFocus
        />
        <Input label={assetClass === "CRYPTO" ? "Exchange" : "Corretora"} value={broker} onChange={(e) => setBroker(e.target.value)} />
        {assetClass === "CRYPTO" && (
          <>
            <Input label="Carteira" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Ex: cold wallet, corretora" />
            <Input label="Rede" value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Ex: Bitcoin, ERC-20" />
          </>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending}>
            Cadastrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
