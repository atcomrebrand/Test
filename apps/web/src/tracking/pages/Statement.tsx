import { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { useTrackingJobs, useTrackingStatement } from "../api";
import { StatementDocument } from "../components/StatementDocument";
import { StatementAudience, StatementLang } from "../types";

/** Primeiro e último dia do mês corrente, que é o recorte que praticamente todo extrato usa. */
function mesAtual() {
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const primeiro = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-01`;
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  return { from: primeiro, to: `${ultimo.getFullYear()}-${pad(ultimo.getMonth() + 1)}-${pad(ultimo.getDate())}` };
}

/**
 * O extrato: escolhe trabalho, período, idioma e via — e imprime.
 *
 * **Não gera arquivo; manda imprimir.** O navegador (celular incluído) oferece "Salvar como PDF" no
 * próprio diálogo, e o resultado sai com texto vetorial, acentuação certa e os gráficos em SVG.
 * Montar o PDF no servidor obrigaria a desenhar os gráficos à mão numa biblioteca, e um Chromium
 * headless sozinho comeria metade da RAM da VPS pra fazer pior o que o navegador já faz de graça.
 */
export default function Statement() {
  const { data: jobs, isLoading: carregandoJobs } = useTrackingJobs();
  const inicial = useMemo(mesAtual, []);

  const [jobId, setJobId] = useState<string | null>(null);
  const [from, setFrom] = useState(inicial.from);
  const [to, setTo] = useState(inicial.to);
  const [lang, setLang] = useState<StatementLang>("PT");
  const [audience, setAudience] = useState<StatementAudience>("PERSONAL");

  const ativos = (jobs ?? []).filter((j) => j.active);
  const escolhido = jobId ?? ativos[0]?.id ?? null;
  const { data, isLoading, isFetching } = useTrackingStatement({ jobId: escolhido, from, to, lang, audience });

  if (carregandoJobs) return <Skeleton className="h-64 rounded-2xl" />;

  if (ativos.length === 0) {
    return (
      <>
        <PageHeader title="Extrato" description="Horas, desempenho e observações num documento pronto pra imprimir." />
        <EmptyState
          icon={<FileText className="h-7 w-7" />}
          title="Nenhum trabalho ativo"
          description="Cadastre um trabalho no módulo Horas pra poder emitir o extrato dele."
        />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* `print:hidden` em tudo que é controle: no papel só entra o documento. */}
      <div className="print:hidden">
        <PageHeader title="Extrato" description="Horas, desempenho e observações num documento pronto pra imprimir." />
      </div>

      <Card className="print:hidden">
        <CardContent className="flex flex-col gap-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="Trabalho"
              value={escolhido ?? ""}
              onChange={(e) => setJobId(e.target.value)}
              options={ativos.map((j) => ({ value: j.id, label: `${j.name} — ${j.company}` }))}
            />
            <Input label="De" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <Input label="Até" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
            <div>
              <span className="mb-1.5 block text-sm font-medium">Idioma</span>
              <Alternador
                valor={lang}
                opcoes={[
                  ["PT", "Português"],
                  ["EN", "English"],
                ]}
                onChange={setLang}
              />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium">Via</span>
            <Alternador
              valor={audience}
              opcoes={[
                ["PERSONAL", "Pessoal"],
                ["COMPANY", "Empresa"],
              ]}
              onChange={setAudience}
            />
            <p className="mt-1.5 text-xs text-muted">
              {audience === "PERSONAL"
                ? "Inclui valores recebidos e valor por hora."
                : "Sem nenhum valor em dinheiro — nem no total, nem por registro. O corte é feito no servidor, então o número não chega nem na resposta."}
            </p>
          </div>

          {lang === "EN" && (
            <p className="text-xs text-muted">
              {data?.translation.available === false
                ? "As observações sairão no idioma original: o tradutor não está configurado no servidor."
                : "Suas observações são traduzidas e a tradução fica guardada — gerar o mesmo extrato de novo não muda o texto."}
            </p>
          )}

          <Button onClick={() => window.print()} disabled={!data || isFetching}>
            <Printer className="h-4 w-4" />
            {isFetching ? "Montando..." : "Imprimir / Salvar PDF"}
          </Button>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <Skeleton className="h-96 rounded-2xl print:hidden" />
      ) : (
        <div className={cn("overflow-x-auto rounded-2xl border border-[rgb(var(--border))] print:overflow-visible print:rounded-none print:border-0")}>
          <StatementDocument data={data} />
        </div>
      )}
    </div>
  );
}

function Alternador<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg surface-2 p-0.5">
      {opcoes.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={valor === v}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            valor === v ? "surface shadow-sm" : "text-muted hover:text-[rgb(var(--text))]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
