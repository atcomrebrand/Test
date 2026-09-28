import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Compass } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { Input } from "@/components/ui/Input";
import { useAssetCatalog } from "../api";
import { AssetClass } from "../types";

const TAB_OPTIONS = [
  { value: "STOCK", label: "Ações" },
  { value: "FII", label: "FIIs" },
  { value: "CRYPTO", label: "Criptomoedas" },
];

/**
 * "Explorar" is separate from "Carteira" on purpose: researching an asset (price, chart,
 * fundamentals) shouldn't require adding it to the portfolio first. This is also where a future
 * investment-rules/recommendations feature would naturally live, since it already covers the
 * whole catalog rather than just what the user owns.
 */
export default function Explore() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AssetClass>("STOCK");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: results, isFetching } = useAssetCatalog(tab, debouncedSearch);
  const hasQuery = debouncedSearch.trim().length >= 2;

  function openAsset(ticker: string) {
    navigate(`/investimentos/explorar/${tab}/${encodeURIComponent(ticker)}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Explorar</h1>
        <p className="text-sm text-muted">
          Pesquise qualquer ação, FII ou criptomoeda pra ver preço, gráfico e dados fundamentalistas — sem precisar
          cadastrar nada antes.
        </p>
      </div>

      <Tabs value={tab} onChange={(v) => setTab(v as AssetClass)} options={TAB_OPTIONS} />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === "CRYPTO" ? "Ex: Bitcoin, BTC, Ethereum..." : "Ex: Petrobras, PETR4, Vale..."}
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {!hasQuery && (
        <EmptyState
          icon={<Compass className="h-7 w-7" />}
          title="Digite pra começar a explorar"
          description="Busque pelo nome ou ticker de qualquer ativo — dá pra ver os dados dele mesmo sem ter na carteira."
        />
      )}

      {hasQuery && isFetching && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {hasQuery && !isFetching && results?.length === 0 && (
        <EmptyState icon={<Search className="h-7 w-7" />} title="Nenhum resultado" description="Tente buscar com outro nome ou ticker." />
      )}

      {hasQuery && !isFetching && results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((entry) => (
            <button key={entry.ticker} onClick={() => openAsset(entry.ticker)} className="text-left">
              <Card className="flex items-center justify-between p-4 transition-colors hover:surface-2">
                <div>
                  <p className="font-semibold">{entry.ticker.toUpperCase()}</p>
                  <p className="text-sm text-muted">{entry.name}</p>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
