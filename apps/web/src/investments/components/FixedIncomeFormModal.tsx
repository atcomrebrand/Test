import { FormEvent, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useCreateFixedIncome, useUpdateFixedIncome } from "../api";
import { InvestmentFixedIncome } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Preenchido = edição. Ausente = cadastro novo. */
  fixedIncome?: InvestmentFixedIncome | null;
}

const TYPE_OPTIONS = [
  { value: "CDB", label: "CDB" },
  { value: "LCI", label: "LCI" },
  { value: "LCA", label: "LCA" },
  { value: "TESOURO", label: "Tesouro Direto" },
  { value: "OUTRO", label: "Outro" },
];

const LIQUIDITY_OPTIONS = [
  { value: "DIARIA", label: "Diária" },
  { value: "NO_VENCIMENTO", label: "No vencimento" },
  { value: "OUTRO", label: "Outro" },
];

const INDEXER_OPTIONS = [
  { value: "PREFIXADO", label: "Prefixado" },
  { value: "POS_FIXADO_CDI", label: "% do CDI" },
  { value: "IPCA_MAIS", label: "IPCA+" },
  { value: "OUTRO", label: "Outro" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function FixedIncomeFormModal({ open, onClose, fixedIncome }: Props) {
  const isEdit = Boolean(fixedIncome);
  const create = useCreateFixedIncome();
  const update = useUpdateFixedIncome();
  const [institution, setInstitution] = useState("");
  const [type, setType] = useState("CDB");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [applicationDate, setApplicationDate] = useState(todayISO());
  const [maturityDate, setMaturityDate] = useState("");
  const [liquidity, setLiquidity] = useState("NO_VENCIMENTO");
  const [indexer, setIndexer] = useState("PREFIXADO");
  const [fixedRatePercent, setFixedRatePercent] = useState("");
  const [cdiPercent, setCdiPercent] = useState("");

  function reset() {
    setInstitution("");
    setType("CDB");
    setPrincipalAmount("");
    setApplicationDate(todayISO());
    setMaturityDate("");
    setLiquidity("NO_VENCIMENTO");
    setIndexer("PREFIXADO");
    setFixedRatePercent("");
    setCdiPercent("");
  }

  // Ao abrir em modo edição, carrega o que está gravado. Só no `open` pra que um refetch em
  // segundo plano não sobrescreva o que o usuário está digitando.
  useEffect(() => {
    if (!open) return;
    if (!fixedIncome) {
      reset();
      return;
    }
    setInstitution(fixedIncome.institution);
    setType(fixedIncome.type);
    setPrincipalAmount(String(fixedIncome.principalAmount));
    setApplicationDate(fixedIncome.applicationDate.slice(0, 10));
    setMaturityDate(fixedIncome.maturityDate.slice(0, 10));
    setLiquidity(fixedIncome.liquidity);
    setIndexer(fixedIncome.indexer);
    setFixedRatePercent(fixedIncome.fixedRatePercent != null ? String(fixedIncome.fixedRatePercent) : "");
    setCdiPercent(fixedIncome.cdiPercent != null ? String(fixedIncome.cdiPercent) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (isEdit && fixedIncome) {
      // Só os campos que a API aceita corrigir. Tipo, liquidez e indexador ficam de fora: mudar
      // o indexador troca a fórmula de rendimento inteira, e aí o certo é cadastrar de novo.
      update.mutate(
        {
          id: fixedIncome.id,
          data: {
            institution,
            principalAmount: Number(principalAmount),
            applicationDate: new Date(applicationDate + "T12:00:00").toISOString(),
            maturityDate: new Date(maturityDate + "T12:00:00").toISOString(),
            cdiPercent: indexer === "POS_FIXADO_CDI" && cdiPercent ? Number(cdiPercent) : undefined,
          },
        },
        { onSuccess: () => onClose() },
      );
      return;
    }

    create.mutate(
      {
        institution,
        type,
        principalAmount: Number(principalAmount),
        applicationDate: new Date(applicationDate + "T12:00:00").toISOString(),
        maturityDate: new Date(maturityDate + "T12:00:00").toISOString(),
        liquidity,
        indexer,
        fixedRatePercent: indexer !== "POS_FIXADO_CDI" && fixedRatePercent ? Number(fixedRatePercent) : undefined,
        cdiPercent: indexer === "POS_FIXADO_CDI" && cdiPercent ? Number(cdiPercent) : undefined,
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Corrigir aplicação" : "Nova aplicação de renda fixa"} size="lg">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Instituição" value={institution} onChange={(e) => setInstitution(e.target.value)} required autoFocus />
          <Select label="Tipo" options={TYPE_OPTIONS} value={type} onChange={(e) => setType(e.target.value)} disabled={isEdit} />
        </div>

        <Input
          label="Valor aplicado (R$)"
          type="number"
          step="0.01"
          min="0"
          value={principalAmount}
          onChange={(e) => setPrincipalAmount(e.target.value)}
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Data de aplicação"
            type="date"
            value={applicationDate}
            onChange={(e) => setApplicationDate(e.target.value)}
            hint={isEdit ? "Um dia de diferença aqui muda o IOF, o IR e a contagem do CDI." : undefined}
            required
          />
          <Input label="Data de vencimento" type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} required />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Liquidez" options={LIQUIDITY_OPTIONS} value={liquidity} onChange={(e) => setLiquidity(e.target.value)} disabled={isEdit} />
          <Select label="Indexador" options={INDEXER_OPTIONS} value={indexer} onChange={(e) => setIndexer(e.target.value)} disabled={isEdit} />
        </div>

        {indexer === "POS_FIXADO_CDI" ? (
          <Input
            label="% do CDI"
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 110"
            value={cdiPercent}
            onChange={(e) => setCdiPercent(e.target.value)}
            required
          />
        ) : (
          <Input
            label={indexer === "IPCA_MAIS" ? "Spread sobre o IPCA (% a.a.)" : "Taxa fixa (% a.a.)"}
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 12"
            value={fixedRatePercent}
            onChange={(e) => setFixedRatePercent(e.target.value)}
            required
          />
        )}

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {isEdit ? "Salvar correção" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
