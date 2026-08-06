import { FormEvent, useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Camera, Check, Keyboard, Loader2, QrCode, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, parseAmountInput } from "@/lib/format";
import { CommitNotaPayload, useCommitNota, useScanNota } from "../api";
import { NotaItem, NotaPreview } from "../types";
import { QrScannerModal } from "../components/QrScannerModal";
import { TaxDisclaimer } from "../components/TaxDisclaimer";

/** The preview is editable, so it lives in state rather than being read straight off the query. */
interface DraftNota {
  accessKey: string;
  storeName: string;
  storeCnpj: string | null;
  purchaseDate: string;
  totalAmount: string;
  taxAmount: number | null;
  items: NotaItem[];
}

function toDraft(preview: NotaPreview): DraftNota {
  return {
    accessKey: preview.accessKey,
    storeName: preview.storeName ?? "",
    storeCnpj: preview.storeCnpj,
    // The portal not giving a date is not a reason to block the import — today is a defensible
    // default the user can correct, and they're holding the paper nota while they confirm.
    purchaseDate: preview.purchaseDate ?? new Date().toISOString().slice(0, 10),
    totalAmount: String(preview.totalAmount ?? preview.itemsTotal),
    taxAmount: preview.taxAmount,
    items: preview.items,
  };
}

export default function Importar() {
  const navigate = useNavigate();
  const scan = useScanNota();
  const commit = useCommitNota();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState<DraftNota | null>(null);

  const runScan = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      setScannerOpen(false);
      scan.mutate(trimmed, { onSuccess: (preview) => setDraft(toDraft(preview)) });
    },
    [scan],
  );

  function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    runScan(code);
  }

  function removeItem(index: number) {
    setDraft((current) => (current ? { ...current, items: current.items.filter((_, i) => i !== index) } : current));
  }

  function onConfirm() {
    if (!draft) return;

    const total = parseAmountInput(draft.totalAmount);
    const payload: CommitNotaPayload = {
      storeName: draft.storeName.trim(),
      storeCnpj: draft.storeCnpj ?? undefined,
      accessKey: draft.accessKey,
      purchaseDate: draft.purchaseDate,
      totalAmount: Number.isFinite(total) ? total : itemsTotal(draft.items),
      taxAmount: draft.taxAmount ?? undefined,
      items: draft.items,
    };

    commit.mutate(payload, {
      onSuccess: (purchase) => {
        setDraft(null);
        setCode("");
        navigate(`/mercado/compras/${purchase.id}`);
      },
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Importar nota"
        description="Escaneie o QR Code da nota fiscal do mercado. Nada é salvo até você conferir e confirmar."
      />

      {!draft && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-500">
                <QrCode className="h-8 w-8" />
              </div>
              <div>
                <p className="font-semibold">Escanear com a câmera</p>
                <p className="mt-1 text-sm text-muted">O QR Code fica no rodapé do cupom, embaixo da lista de produtos.</p>
              </div>
              <Button size="lg" onClick={() => setScannerOpen(true)} disabled={scan.isPending}>
                <Camera className="h-5 w-5" />
                Abrir a câmera
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <form onSubmit={onSubmitCode} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Keyboard className="h-4 w-4 text-muted" />
                  Ou digite a chave de acesso
                </div>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Os 44 dígitos impressos na nota, ou o link do QR Code"
                  inputMode="numeric"
                  disabled={scan.isPending}
                />
                <Button type="submit" variant="outline" loading={scan.isPending} disabled={!code.trim()}>
                  Buscar na SEFAZ
                </Button>
              </form>
            </CardContent>
          </Card>

          {scan.isPending && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Consultando a SEFAZ-SP — notas grandes levam alguns segundos.
            </p>
          )}
        </div>
      )}

      {draft && (
        <NotaReview
          draft={draft}
          onChange={setDraft}
          onRemoveItem={removeItem}
          onCancel={() => setDraft(null)}
          onConfirm={onConfirm}
          confirming={commit.isPending}
        />
      )}

      <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={runScan} />
    </div>
  );
}

function itemsTotal(items: NotaItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
}

interface NotaReviewProps {
  draft: DraftNota;
  onChange: (draft: DraftNota) => void;
  onRemoveItem: (index: number) => void;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}

function NotaReview({ draft, onChange, onRemoveItem, onCancel, onConfirm, confirming }: NotaReviewProps) {
  const somaItens = itemsTotal(draft.items);
  const total = parseAmountInput(draft.totalAmount);
  const divergencia = Number.isFinite(total) ? Math.abs(total - somaItens) : 0;
  const podeConfirmar = draft.storeName.trim().length > 0 && draft.items.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* A mismatch means a line failed to parse, which would silently understate a product's price
          history. Saying so beats a preview that looks complete and isn't. */}
      {divergencia > 0.01 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            A soma dos itens ({formatCurrency(somaItens)}) não bate com o total da nota ({formatCurrency(total)}) — diferença de{" "}
            {formatCurrency(divergencia)}. Alguma linha pode não ter sido lida. Confira no cupom antes de confirmar.
          </span>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Mercado" value={draft.storeName} onChange={(e) => onChange({ ...draft, storeName: e.target.value })} />
            <Input
              label="Data da compra"
              type="date"
              value={draft.purchaseDate}
              onChange={(e) => onChange({ ...draft, purchaseDate: e.target.value })}
            />
            <Input
              label="Total da nota"
              value={draft.totalAmount}
              onChange={(e) => onChange({ ...draft, totalAmount: e.target.value })}
              inputMode="decimal"
            />
            <div>
              <p className="mb-1.5 block text-sm font-medium">Tributos</p>
              <div className="flex h-10 items-center rounded-xl border border-dashed border-[rgb(var(--border))] px-3 text-sm">
                {draft.taxAmount === null ? (
                  <span className="text-muted">Essa nota não declarou</span>
                ) : (
                  <span className="font-medium">{formatCurrency(draft.taxAmount)}</span>
                )}
              </div>
            </div>
          </div>

          {draft.taxAmount !== null && <TaxDisclaimer />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {draft.items.length} {draft.items.length === 1 ? "item" : "itens"}
            </p>
            <Badge tone={divergencia > 0.01 ? "warning" : "success"}>Soma: {formatCurrency(somaItens)}</Badge>
          </div>

          <ul className="-mx-1 max-h-[26rem] divide-y divide-[rgb(var(--border))] overflow-y-auto">
            {draft.items.map((item, index) => (
              <li key={`${item.description}-${index}`} className="flex items-center gap-3 px-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted">
                    {item.quantity.toLocaleString("pt-BR")} {item.unit} × {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{formatCurrency(item.totalPrice)}</span>
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`Remover ${item.description}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={confirming}>
          Descartar
        </Button>
        <Button onClick={onConfirm} loading={confirming} disabled={!podeConfirmar}>
          <Check className="h-4 w-4" />
          Confirmar e salvar
        </Button>
      </div>
    </div>
  );
}
