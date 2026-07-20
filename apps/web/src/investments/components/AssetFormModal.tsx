import { FormEvent, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useCreateAsset } from "../api";
import { AssetClass } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  assetClass: AssetClass;
}

const CLASS_LABEL: Record<AssetClass, string> = { STOCK: "ação", FII: "FII", CRYPTO: "criptomoeda" };

/** Main stablecoins — the most common case for configuring a staking APY, since it varies per
 *  exchange and isn't something we can look up automatically. */
const STABLECOIN_TICKERS = ["USDT", "USDC", "BUSD", "DAI", "FRAX", "TUSD"];

export function AssetFormModal({ open, onClose, assetClass }: Props) {
  const create = useCreateAsset();
  const [ticker, setTicker] = useState("");
  const [broker, setBroker] = useState("");
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState("");
  const [stakingApy, setStakingApy] = useState("");

  function reset() {
    setTicker("");
    setBroker("");
    setWallet("");
    setNetwork("");
    setStakingApy("");
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        class: assetClass,
        ticker,
        broker: broker || undefined,
        wallet: wallet || undefined,
        network: network || undefined,
        stakingApyPercent: stakingApy ? Number(stakingApy) : undefined,
      },
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

        {assetClass === "CRYPTO" && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-muted">Stablecoins comuns:</span>
            {STABLECOIN_TICKERS.map((symbol) => (
              <button key={symbol} type="button" onClick={() => setTicker(symbol)}>
                <Badge tone={ticker === symbol ? "accent" : "neutral"} className="cursor-pointer">
                  {symbol}
                </Badge>
              </button>
            ))}
          </div>
        )}

        <Input label={assetClass === "CRYPTO" ? "Exchange" : "Corretora"} value={broker} onChange={(e) => setBroker(e.target.value)} />
        {assetClass === "CRYPTO" && (
          <>
            <Input label="Carteira" value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Ex: cold wallet, corretora" />
            <Input label="Rede" value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Ex: Bitcoin, ERC-20" />
            <Input
              label="APY de staking (% a.a.) — opcional"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 8.5"
              value={stakingApy}
              onChange={(e) => setStakingApy(e.target.value)}
              hint="Cada corretora paga uma taxa diferente — deixe em branco se não for fazer staking."
            />
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
