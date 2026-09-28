import { useEffect, useState } from "react";
import { Plus, Store, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency } from "@/lib/format";
import { useArchiveChannel, useProfitChannels, useSaveChannel } from "../api";
import { CHANNEL_LABEL, formatPercent } from "../theme";
import { ProfitChannel, ProfitChannelType } from "../types";

/** Atalhos com as taxas típicas de cada lugar. São ponto de partida, não verdade: as taxas mudam e
 *  variam por categoria, então tudo continua editável — sem isso, um número desatualizado no código
 *  viraria preço errado sem ninguém perceber. */
const MODELOS: { nome: string; type: ProfitChannelType; feePercent: number; feeFixed: number }[] = [
  { nome: "Shopee", type: "MARKETPLACE", feePercent: 20, feeFixed: 4 },
  { nome: "Mercado Livre", type: "MARKETPLACE", feePercent: 16, feeFixed: 6 },
  { nome: "Loja própria", type: "OWN_STORE", feePercent: 4.99, feeFixed: 0.39 },
  { nome: "PIX direto", type: "DIRECT", feePercent: 0, feeFixed: 0 },
];

export default function Canais() {
  const { data, isLoading } = useProfitChannels();
  const [editando, setEditando] = useState<ProfitChannel | null>(null);
  const [criando, setCriando] = useState(false);
  const [arquivando, setArquivando] = useState<ProfitChannel | null>(null);
  const arquivar = useArchiveChannel();

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Canais"
        description="Onde você vende e quanto cada lugar cobra. As taxas ficam aqui, não no produto."
        actions={
          <Button onClick={() => setCriando(true)}>
            <Plus className="h-4 w-4" />
            Novo canal
          </Button>
        }
      />

      {(data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Store className="h-7 w-7" />}
          title="Nenhum canal cadastrado"
          description="Cadastre onde você vende pra comparar o mesmo produto em cada lugar."
          action={<Button onClick={() => setCriando(true)}>Cadastrar o primeiro</Button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-start justify-between gap-3 py-4">
                <button type="button" onClick={() => setEditando(c)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-xs text-muted">{CHANNEL_LABEL[c.type]}</p>
                  <p className="mt-1 text-sm">
                    {formatPercent(Number(c.feePercent), 2)}
                    {Number(c.feeFixed) > 0 && <> + {formatCurrency(Number(c.feeFixed))}</>}
                  </p>
                  <p className="text-xs text-muted">
                    {Number(c.shippingCost) > 0 && <>frete {formatCurrency(Number(c.shippingCost))} · </>}
                    devolução {formatPercent(Number(c.returnRatePercent), 1)}
                  </p>
                </button>
                <button
                  onClick={() => setArquivando(c)}
                  aria-label={`Arquivar ${c.name}`}
                  className="shrink-0 rounded-lg p-2 text-muted hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CanalModal open={criando || !!editando} canal={editando} onClose={() => { setCriando(false); setEditando(null); }} />

      <ConfirmModal
        open={!!arquivando}
        onClose={() => setArquivando(null)}
        onConfirm={() => arquivando && arquivar.mutate(arquivando.id, { onSuccess: () => setArquivando(null) })}
        title="Arquivar canal"
        description={`"${arquivando?.name}" sai da lista, mas os preços que você já definiu nele continuam guardados.`}
        confirmLabel="Arquivar"
      />
    </div>
  );
}

function CanalModal({ open, canal, onClose }: { open: boolean; canal: ProfitChannel | null; onClose: () => void }) {
  const salvar = useSaveChannel();
  const [name, setName] = useState("");
  const [type, setType] = useState<ProfitChannelType>("MARKETPLACE");
  const [feePercent, setFeePercent] = useState("0");
  const [feeFixed, setFeeFixed] = useState("0");
  const [shippingCost, setShipping] = useState("0");
  const [returnRate, setReturn] = useState("0");

  useEffect(() => {
    if (!open) return;
    setName(canal?.name ?? "");
    setType(canal?.type ?? "MARKETPLACE");
    setFeePercent(String(Number(canal?.feePercent ?? 0)));
    setFeeFixed(String(Number(canal?.feeFixed ?? 0)));
    setShipping(String(Number(canal?.shippingCost ?? 0)));
    setReturn(String(Number(canal?.returnRatePercent ?? 0)));
  }, [open, canal]);

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")) || 0);

  function aplicarModelo(m: (typeof MODELOS)[number]) {
    setName(m.nome);
    setType(m.type);
    setFeePercent(String(m.feePercent));
    setFeeFixed(String(m.feeFixed));
  }

  return (
    <Modal open={open} onClose={onClose} title={canal ? "Editar canal" : "Novo canal"}>
      <div className="flex flex-col gap-4">
        {!canal && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Começar de um modelo</p>
            <div className="flex flex-wrap gap-1.5">
              {MODELOS.map((m) => (
                <button
                  key={m.nome}
                  type="button"
                  onClick={() => aplicarModelo(m)}
                  className="rounded-full surface-2 px-3 py-1 text-xs font-semibold text-muted hover:brightness-95"
                >
                  {m.nome}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-muted">As taxas são só um ponto de partida — confira as do seu contrato.</p>
          </div>
        )}

        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Select
          label="Tipo"
          value={type}
          onChange={(e) => setType(e.target.value as ProfitChannelType)}
          options={(Object.keys(CHANNEL_LABEL) as ProfitChannelType[]).map((t) => ({ value: t, label: CHANNEL_LABEL[t] }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Taxa (%)" inputMode="decimal" value={feePercent} onChange={(e) => setFeePercent(e.target.value)} />
          <Input label="Taxa fixa por pedido (R$)" inputMode="decimal" value={feeFixed} onChange={(e) => setFeeFixed(e.target.value)} />
          <Input
            label="Frete que você paga (R$)"
            inputMode="decimal"
            value={shippingCost}
            onChange={(e) => setShipping(e.target.value)}
            hint="Deixe 0 se o cliente paga"
          />
          <Input label="Devolução esperada (%)" inputMode="decimal" value={returnRate} onChange={(e) => setReturn(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name.trim()}
            loading={salvar.isPending}
            onClick={() =>
              salvar.mutate(
                {
                  id: canal?.id,
                  data: {
                    name: name.trim(),
                    type,
                    feePercent: num(feePercent),
                    feeFixed: num(feeFixed),
                    shippingCost: num(shippingCost),
                    returnRatePercent: num(returnRate),
                  },
                },
                { onSuccess: onClose },
              )
            }
          >
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
