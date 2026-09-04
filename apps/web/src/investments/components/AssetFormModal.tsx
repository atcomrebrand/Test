import { FormEvent, useEffect, useState } from "react";
import { Search, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAssetCatalog, useCreateAsset } from "../api";
import { AssetClass } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  assetClass: AssetClass;
  /** Pre-fill from "Explorar" so picking an already-searched asset doesn't require searching again. */
  prefill?: { ticker: string; name?: string };
}

const CLASS_LABEL: Record<AssetClass, string> = { STOCK: "ação", FII: "FII", CRYPTO: "criptomoeda" };

/** Main stablecoins — the most common case for configuring a staking APY, since it varies per
 *  exchange and isn't something we can look up automatically. */
const STABLECOIN_TICKERS = ["USDT", "USDC", "BUSD", "DAI", "FRAX", "TUSD"];

export function AssetFormModal({ open, onClose, assetClass, prefill }: Props) {
  const create = useCreateAsset();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [broker, setBroker] = useState("");
  const [wallet, setWallet] = useState("");
  const [network, setNetwork] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [selected, setSelected] = useState(false);

  // Only re-apply the prefill when the modal opens — not on every `prefill` reference change —
  // same reasoning as the PayoffQuoteModal fix: a background refetch elsewhere must not wipe form state.
  useEffect(() => {
    if (open && prefill) {
      setTicker(prefill.ticker);
      setName(prefill.name ?? prefill.ticker);
      setSearch(prefill.name ?? prefill.ticker);
      setSelected(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: results, isFetching } = useAssetCatalog(assetClass, debouncedSearch);
  const showResults = search.trim().length >= 2 && !selected;

  function reset() {
    setSearch("");
    setDebouncedSearch("");
    setTicker("");
    setName("");
    setBroker("");
    setWallet("");
    setNetwork("");
    setSelected(false);
  }

  function selectEntry(entry: { ticker: string; name: string }) {
    setTicker(entry.ticker);
    setName(entry.name);
    setSearch(entry.name);
    setSelected(true);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    create.mutate(
      {
        class: assetClass,
        ticker: ticker || search.toUpperCase(),
        name: name || undefined,
        broker: broker || undefined,
        wallet: wallet || undefined,
        network: network || undefined,
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
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              label={assetClass === "CRYPTO" ? "Buscar moeda (ex: Bitcoin, BTC)" : "Buscar ativo (ex: Petrobras, PETR4)"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setTicker("");
                setName("");
                setSelected(false);
              }}
              className="pl-9"
              required={!ticker}
              autoFocus
              autoComplete="off"
            />
          </div>

          {showResults && (
            <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[rgb(var(--border))] surface shadow-elevated">
              {isFetching && <p className="px-3 py-2 text-sm text-muted">Buscando...</p>}
              {!isFetching && results?.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">
                  Nenhum resultado — você ainda pode cadastrar "{search.toUpperCase()}" manualmente.
                </p>
              )}
              {results?.map((entry) => (
                <button
                  key={entry.ticker}
                  type="button"
                  onClick={() => selectEntry(entry)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:surface-2"
                >
                  <span className="font-semibold">{entry.ticker.toUpperCase()}</span>
                  <span className="truncate text-muted">{entry.name}</span>
                </button>
              ))}
            </div>
          )}

          {ticker && (
            <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Selecionado: {ticker.toUpperCase()}
            </p>
          )}
        </div>

        {assetClass === "CRYPTO" && (
          <div className="-mt-2 flex flex-wrap gap-1.5">
            <span className="text-xs text-muted">Stablecoins comuns:</span>
            {STABLECOIN_TICKERS.map((symbol) => (
              <button key={symbol} type="button" onClick={() => selectEntry({ ticker: symbol, name: symbol })}>
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
