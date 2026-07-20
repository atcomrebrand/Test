import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Upload, FileSpreadsheet, ChevronDown, ChevronUp, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { formatCurrency, formatDate } from "@/lib/format";
import { B3FileFormatError, parseMovimentacaoFile, parseNegociacaoFile } from "../lib/b3-import-parser";
import { SimpleCsvFormatError, parseSimpleCsvFile } from "../lib/simple-csv-parser";
import { useCommitB3Import, usePreviewB3Import, usePreviewCsvImport } from "../api";
import { B3ImportPreviewResult, DividendSuggestion, ImportedIncome, ImportedTransaction } from "../types";

type ImportMethod = "b3" | "csv";

const INCOME_TYPE_LABEL: Record<string, string> = { DIVIDENDO: "Dividendo", JCP: "JCP", RENDIMENTO: "Rendimento", OUTRO: "Outro" };

function suggestionToIncomeInput(s: DividendSuggestion): ImportedIncome {
  return {
    ticker: s.ticker,
    assetClass: s.assetClass,
    assetName: null,
    type: s.type,
    amount: s.amount,
    paymentDate: s.paymentDate,
    sourceLabel: s.relatedTo ? `Sugestão via histórico B3: ${s.relatedTo}` : "Sugestão via histórico B3",
  };
}

function FilePicker({
  label,
  file,
  onChange,
  accept = ".xlsx",
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-1 flex-col gap-2 rounded-xl surface-2 p-4">
      <p className="text-sm font-semibold">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 rounded-lg border border-dashed border-[rgb(var(--border))] px-3 py-3 text-left text-sm text-muted transition-colors hover:surface"
      >
        <Upload className="h-4 w-4 shrink-0" />
        {file ? <span className="truncate text-[rgb(var(--text))]">{file.name}</span> : `Escolher arquivo ${accept}`}
      </button>
    </div>
  );
}

function SelectAllHeader({ allSelected, onToggle, label }: { allSelected: boolean; onToggle: () => void; label: string }) {
  return (
    <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-[rgb(var(--text))]">
      {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

export default function ImportB3() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<ImportMethod>("csv");
  const [negociacaoFile, setNegociacaoFile] = useState<File | null>(null);
  const [movimentacaoFile, setMovimentacaoFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<B3ImportPreviewResult | null>(null);
  const [excludedTx, setExcludedTx] = useState<Set<number>>(new Set());
  const [excludedIncome, setExcludedIncome] = useState<Set<number>>(new Set());
  const [includedSuggestions, setIncludedSuggestions] = useState<Set<number>>(new Set());
  const [skippedOpen, setSkippedOpen] = useState(false);

  const previewMutation = usePreviewB3Import();
  const previewCsvMutation = usePreviewCsvImport();
  const commitMutation = useCommitB3Import();

  function changeMethod(next: ImportMethod) {
    setMethod(next);
    setPreview(null);
  }

  async function handleAnalyze() {
    if (method === "csv") {
      if (!csvFile) {
        toast.error("Selecione o arquivo .csv.");
        return;
      }
      setParsing(true);
      let rows: Record<string, unknown>[] = [];
      try {
        rows = await parseSimpleCsvFile(csvFile);
      } catch (err) {
        setParsing(false);
        toast.error(err instanceof SimpleCsvFormatError ? err.message : "Não foi possível ler o arquivo — confira se é o .csv esperado.");
        return;
      }
      try {
        const result = await previewCsvMutation.mutateAsync(rows);
        setPreview(result);
        setExcludedTx(new Set());
        setExcludedIncome(new Set());
        setIncludedSuggestions(new Set());
      } catch {
        // já mostrado via toast no hook
      } finally {
        setParsing(false);
      }
      return;
    }

    if (!negociacaoFile && !movimentacaoFile) {
      toast.error("Selecione pelo menos um arquivo (Negociação ou Movimentação).");
      return;
    }

    setParsing(true);
    let negociacao: Record<string, unknown>[] = [];
    let movimentacao: Record<string, unknown>[] = [];
    try {
      if (negociacaoFile) negociacao = await parseNegociacaoFile(negociacaoFile);
      if (movimentacaoFile) movimentacao = await parseMovimentacaoFile(movimentacaoFile);
    } catch (err) {
      setParsing(false);
      toast.error(err instanceof B3FileFormatError ? err.message : "Não foi possível ler o arquivo — confira se é um .xlsx exportado da B3.");
      return;
    }

    try {
      const result = await previewMutation.mutateAsync({ negociacao, movimentacao });
      setPreview(result);
      setExcludedTx(new Set());
      setExcludedIncome(new Set());
      setIncludedSuggestions(new Set());
    } catch {
      // já mostrado via toast no hook
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    const transactions = preview.transactions.filter((_, i) => !excludedTx.has(i));
    const incomes = [
      ...preview.incomes.filter((_, i) => !excludedIncome.has(i)),
      ...preview.suggestedIncomes.filter((_, i) => includedSuggestions.has(i)).map(suggestionToIncomeInput),
    ];
    if (transactions.length === 0 && incomes.length === 0) {
      toast.error("Nenhum item selecionado para importar.");
      return;
    }
    await commitMutation.mutateAsync({ transactions, incomes });
    navigate("/investimentos/carteira");
  }

  const includedTxCount = preview ? preview.transactions.length - excludedTx.size : 0;
  const includedIncomeCount = preview ? preview.incomes.length - excludedIncome.size : 0;
  const includedSuggestionCount = includedSuggestions.size;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Importar</h1>
        <p className="text-sm text-muted">
          {method === "csv"
            ? "Suba um .csv com uma linha por negociação (Ativo, Tipo de investimento, Tipo de ordem, Quantidade, Preço unitário, Data do lançamento). Não precisa de proventos/dividendos no arquivo — eles são sugeridos automaticamente a partir do histórico da BRAPI, com base na posição que essas negociações estabelecem."
            : 'Suba os extratos "Negociação" e/ou "Movimentação" da Área do Investidor da B3 (formato .xlsx) — o sistema classifica compras, vendas e proventos automaticamente.'}{" "}
          Nada é gravado antes de você confirmar.
        </p>
      </div>

      <Tabs
        value={method}
        onChange={(v) => changeMethod(v as ImportMethod)}
        options={[
          { value: "csv", label: "CSV simples" },
          { value: "b3", label: "Extratos da B3 (xlsx)" },
        ]}
      />

      <Card>
        <CardContent className="flex flex-col gap-4">
          {method === "csv" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <FilePicker label="Negociações (.csv)" file={csvFile} onChange={setCsvFile} accept=".csv" />
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <FilePicker label="Negociação (compras/vendas)" file={negociacaoFile} onChange={setNegociacaoFile} />
              <FilePicker label="Movimentação (extrato)" file={movimentacaoFile} onChange={setMovimentacaoFile} />
            </div>
          )}
          <Button onClick={handleAnalyze} loading={parsing || previewMutation.isPending || previewCsvMutation.isPending} className="self-start">
            <FileSpreadsheet className="h-4 w-4" />
            Analisar
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <>
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-muted">Negociações</p>
                <p className="text-lg font-semibold">
                  {includedTxCount}/{preview.transactions.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Proventos do extrato</p>
                <p className="text-lg font-semibold">
                  {includedIncomeCount}/{preview.incomes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Sugestões (BRAPI)</p>
                <p className="text-lg font-semibold">
                  {includedSuggestionCount}/{preview.suggestedIncomes.length}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Ignoradas</p>
                <p className="text-lg font-semibold">{preview.skipped.length}</p>
              </div>
            </CardContent>
          </Card>

          {(preview.duplicateTransactionsSkipped > 0 || preview.duplicateIncomesSkipped > 0) && (
            <p className="text-xs text-muted">
              {preview.duplicateTransactionsSkipped} negociação(ões) e {preview.duplicateIncomesSkipped} provento(s) já
              estavam na sua carteira e não aparecem aqui de novo.
            </p>
          )}

          {preview.transactions.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Compras e vendas</CardTitle>
                <SelectAllHeader
                  allSelected={excludedTx.size === 0}
                  onToggle={() => setExcludedTx(excludedTx.size === 0 ? new Set(preview.transactions.map((_, i) => i)) : new Set())}
                  label={excludedTx.size === 0 ? "Desmarcar todas" : "Marcar todas"}
                />
              </CardHeader>
              <CardContent>
                <div className="-mx-5 -mb-5 max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 surface-2 text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="px-3 py-2 font-medium">Ativo</th>
                        <th className="px-3 py-2 font-medium">Tipo</th>
                        <th className="px-3 py-2 text-right font-medium">Qtd</th>
                        <th className="px-3 py-2 text-right font-medium">Preço</th>
                        <th className="px-3 py-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border))]">
                      {preview.transactions.map((t: ImportedTransaction, i: number) => (
                        <tr key={i} className={excludedTx.has(i) ? "opacity-40" : ""}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!excludedTx.has(i)}
                              onChange={() => {
                                const next = new Set(excludedTx);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                setExcludedTx(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{t.ticker}</td>
                          <td className="px-3 py-2">
                            <Badge tone={t.type === "BUY" ? "success" : "danger"}>{t.type === "BUY" ? "Compra" : "Venda"}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">{t.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatCurrency(t.unitPrice)}</td>
                          <td className="px-3 py-2 text-muted">{formatDate(t.transactionDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.incomes.length > 0 && (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Proventos do extrato</CardTitle>
                <SelectAllHeader
                  allSelected={excludedIncome.size === 0}
                  onToggle={() => setExcludedIncome(excludedIncome.size === 0 ? new Set(preview.incomes.map((_, i) => i)) : new Set())}
                  label={excludedIncome.size === 0 ? "Desmarcar todos" : "Marcar todos"}
                />
              </CardHeader>
              <CardContent>
                <div className="-mx-5 -mb-5 max-h-80 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 surface-2 text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="px-3 py-2 font-medium">Ativo</th>
                        <th className="px-3 py-2 font-medium">Tipo</th>
                        <th className="px-3 py-2 text-right font-medium">Valor</th>
                        <th className="px-3 py-2 font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border))]">
                      {preview.incomes.map((inc: ImportedIncome, i: number) => (
                        <tr key={i} className={excludedIncome.has(i) ? "opacity-40" : ""}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={!excludedIncome.has(i)}
                              onChange={() => {
                                const next = new Set(excludedIncome);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                setExcludedIncome(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{inc.ticker}</td>
                          <td className="px-3 py-2">
                            <Badge tone="accent">{INCOME_TYPE_LABEL[inc.type]}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(inc.amount)}</td>
                          <td className="px-3 py-2 text-muted">{formatDate(inc.paymentDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.suggestedIncomes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Proventos sugeridos (histórico da BRAPI)</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-xs text-muted">
                  Pagamentos que o histórico de dividendos da BRAPI mostra pra esses ativos e que não apareceram no seu
                  extrato — calculados com base na posição que você tinha na data-com. Marque os que quiser adicionar;
                  nenhum é incluído por padrão.
                </p>
                <div className="max-h-64 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 surface-2 text-left text-xs uppercase text-muted">
                      <tr>
                        <th className="w-8 px-3 py-2"></th>
                        <th className="px-3 py-2 font-medium">Ativo</th>
                        <th className="px-3 py-2 font-medium">Tipo</th>
                        <th className="px-3 py-2 text-right font-medium">Valor estimado</th>
                        <th className="px-3 py-2 font-medium">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border))]">
                      {preview.suggestedIncomes.map((s: DividendSuggestion, i: number) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={includedSuggestions.has(i)}
                              onChange={() => {
                                const next = new Set(includedSuggestions);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                setIncludedSuggestions(next);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{s.ticker}</td>
                          <td className="px-3 py-2">
                            <Badge tone="warning">{INCOME_TYPE_LABEL[s.type]}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(s.amount)}</td>
                          <td className="px-3 py-2 text-muted">{formatDate(s.paymentDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {preview.skipped.length > 0 && (
            <Card>
              <button onClick={() => setSkippedOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left">
                <span className="text-sm font-semibold">Linhas ignoradas ({preview.skipped.length})</span>
                {skippedOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
              </button>
              {skippedOpen && (
                <CardContent className="max-h-64 overflow-y-auto pt-0">
                  <div className="flex flex-col gap-1.5">
                    {preview.skipped.map((s, i) => (
                      <div key={i} className="rounded-lg surface-2 px-3 py-2 text-xs">
                        <p className="text-muted">{s.description}</p>
                        <p>{s.reason}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <Button onClick={handleCommit} loading={commitMutation.isPending} className="self-start">
            Confirmar importação ({includedTxCount + includedIncomeCount + includedSuggestionCount} itens)
          </Button>
        </>
      )}
    </div>
  );
}
