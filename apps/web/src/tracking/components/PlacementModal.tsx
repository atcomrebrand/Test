import { FormEvent, useEffect, useState } from "react";
import { Award } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface PlacementValues {
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

interface Props {
  open: boolean;
  jobName: string;
  loading?: boolean;
  /** Salvar com o que foi preenchido. Campo vazio vai como `null` — pular é mandar os três nulos. */
  onConfirm: (values: PlacementValues) => void;
  onSkip: () => void;
}

/**
 * "Qual foi sua colocação hoje?" — a pergunta que aparece ao encerrar a sessão de um serviço com
 * ranking.
 *
 * Os três campos são texto livre com teclado numérico e **rascunho local**, não número controlado:
 * um `Number(e.target.value)` a cada tecla impede apagar o campo (vira 0 ou NaN na hora) e obriga a
 * selecionar tudo antes de digitar — foi exatamente o incômodo já corrigido nos campos da Academia.
 * A conversão acontece uma vez, no envio.
 *
 * **Pular nunca some da tela.** O encerramento da sessão não pode ficar refém de um número que
 * talvez ainda não tenha saído; quem pulou preenche depois, editando a sessão.
 */
export function PlacementModal({ open, jobName, loading, onConfirm, onSkip }: Props) {
  const [placement, setPlacement] = useState("");
  const [satisfaction, setSatisfaction] = useState("");
  const [response, setResponse] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPlacement("");
    setSatisfaction("");
    setResponse("");
    setErro(null);
  }, [open]);

  function parse(raw: string): number | null {
    const limpo = raw.trim().replace(",", ".");
    if (!limpo) return null;
    const n = Number(limpo);
    return Number.isFinite(n) ? n : NaN;
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const p = parse(placement);
    const s = parse(satisfaction);
    const r = parse(response);

    if (Number.isNaN(p) || Number.isNaN(s) || Number.isNaN(r)) return setErro("Use só números.");
    if (p !== null && (!Number.isInteger(p) || p < 1)) return setErro("A colocação começa em 1.");
    if (s !== null && (s < 0 || s > 100)) return setErro("A satisfação vai de 0% a 100%.");
    if (r !== null && (!Number.isInteger(r) || r < 0)) return setErro("O tempo de resposta é em minutos inteiros.");

    setErro(null);
    onConfirm({ placement: p, satisfactionPercent: s, responseMinutes: r });
  }

  return (
    // Sem `onClose` que fecha no clique fora: a sessão já foi encerrada quando este modal abre, e
    // sumir sem gravar deixaria o dia sem o número sem a pessoa ter escolhido isso. Sair é pelo
    // botão "Pular", que diz o que está acontecendo.
    <Modal open={open} onClose={onSkip} title="Como foi hoje?">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/40">
          <Award className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
          <p className="text-sm">
            Resultado do dia em <span className="font-semibold">{jobName}</span>. Pode preencher só o que já saiu.
          </p>
        </div>

        <Input
          label="Colocação"
          inputMode="numeric"
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          placeholder="Ex.: 3"
          autoFocus
        />
        <Input
          label="Satisfação dos clientes (%)"
          inputMode="decimal"
          value={satisfaction}
          onChange={(e) => setSatisfaction(e.target.value)}
          placeholder="Ex.: 96,5"
        />
        <Input
          label="Tempo de resposta (minutos)"
          inputMode="numeric"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Ex.: 4"
        />

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onSkip} disabled={loading}>
            Pular
          </Button>
          <Button type="submit" loading={loading}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
