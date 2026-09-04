import { useState } from "react";
import { Search as SearchIcon, Timer, Wallet } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useTrackingSearch } from "../api";

const TYPE_META = {
  SESSION: { label: "Sessão", icon: Timer, color: "text-violet-500 bg-violet-500/10" },
  INCOME: { label: "Entrada", icon: Wallet, color: "text-blue-500 bg-blue-500/10" },
} as const;

export default function Search() {
  const [query, setQuery] = useState("");
  const { data, isLoading } = useTrackingSearch(query);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Busca</h1>
        <p className="text-sm text-muted">Pesquise por cliente, empresa, projeto, valor, categoria, data ou observações.</p>
      </div>

      <Input
        autoFocus
        placeholder="Digite para buscar..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {query.trim().length === 0 && (
        <EmptyState icon={<SearchIcon className="h-7 w-7" />} title="Comece digitando" description="Busque em sessões, projetos e outras entradas ao mesmo tempo." />
      )}

      {query.trim().length > 0 && isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      )}

      {query.trim().length > 0 && !isLoading && (!data || data.length === 0) && (
        <EmptyState icon={<SearchIcon className="h-7 w-7" />} title="Nada encontrado" description={`Nenhum resultado para "${query}".`} />
      )}

      <div className="flex flex-col gap-2">
        {data?.map((result) => {
          const meta = TYPE_META[result.type];
          const Icon = meta.icon;
          return (
            <Card key={`${result.type}-${result.id}`}>
              <CardContent className="flex items-center gap-3 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{result.label}</p>
                  <p className="text-xs text-muted">
                    {meta.label} · {result.sublabel} · {formatDate(result.date)}
                  </p>
                </div>
                {result.amount > 0 && <p className="shrink-0 font-semibold">{formatCurrency(result.amount)}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
