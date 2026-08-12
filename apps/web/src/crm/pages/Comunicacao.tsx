import { useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useCreateCrmTemplate,
  useCrmTemplates,
  useDeleteCrmTemplate,
  useUpdateCrmTemplate,
} from "../api";
import { CrmMessageTemplate } from "../types";

const CATEGORIAS = [
  { value: "RENEWAL", label: "Renovação" },
  { value: "DUE", label: "Vencimento" },
  { value: "DELINQUENCY", label: "Inadimplência" },
  { value: "RETENTION", label: "Retenção" },
  { value: "SUPPORT", label: "Suporte" },
  { value: "WELCOME", label: "Boas-vindas" },
  { value: "RESELLER", label: "Revendedor" },
  { value: "OTHER", label: "Outros" },
];

const VARS_CLIENTE = [
  "nome", "valor", "data_vencimento", "dias_para_vencer", "servico",
  "plano", "meses_assinante", "forma_pagamento", "telefone",
];
const VARS_REVENDEDOR = [
  "nome", "servico", "saldo_creditos", "clientes_aproximados",
  "valor_recarga", "quantidade_creditos", "data_ultima_recarga", "telefone",
];

function TemplateModal({
  open,
  onClose,
  template,
}: {
  open: boolean;
  onClose: () => void;
  template?: CrmMessageTemplate;
}) {
  const create = useCreateCrmTemplate();
  const update = useUpdateCrmTemplate();
  const [form, setForm] = useState({
    name: template?.name ?? "",
    category: template?.category ?? "OTHER",
    body: template?.body ?? "",
    forReseller: template?.forReseller ?? false,
  });

  const vars = form.forReseller ? VARS_REVENDEDOR : VARS_CLIENTE;

  return (
    <Modal open={open} onClose={onClose} title={template ? "Editar template" : "Novo template"} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const done = () => onClose();
          if (template) update.mutate({ id: template.id, data: form }, { onSuccess: done });
          else create.mutate(form, { onSuccess: done });
        }}
        className="flex flex-col gap-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Select
            label="Categoria"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as never })}
            options={CATEGORIAS}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.forReseller}
            onChange={(e) => setForm({ ...form, forReseller: e.target.checked })}
            className="h-4 w-4 rounded"
          />
          Template de revendedor (as variáveis disponíveis mudam)
        </label>

        <div>
          <label className="mb-1 block text-sm font-medium">Mensagem</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={7}
            required
            className="surface w-full rounded-xl border border-[rgb(var(--border))] px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        {/* Clicar insere no fim: digitar {{ }} à mão erra o nome e o texto sai quebrado. */}
        <div className="flex flex-wrap gap-1.5">
          {vars.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setForm({ ...form, body: `${form.body}{{${v}}}` })}
              className="surface-2 rounded-md px-2 py-1 text-xs font-mono transition-colors hover:bg-indigo-500/10"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Comunicacao() {
  const { data: templates, isLoading } = useCrmTemplates();
  const remove = useDeleteCrmTemplate();
  const [editando, setEditando] = useState<CrmMessageTemplate | undefined>();
  const [criando, setCriando] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;

  const clientes = (templates ?? []).filter((t) => !t.forReseller);
  const revenda = (templates ?? []).filter((t) => t.forReseller);

  const Lista = ({ items, titulo }: { items: CrmMessageTemplate[]; titulo: string }) => (
    <section>
      <h2 className="mb-2 text-sm font-semibold">{titulo}</h2>
      <div className="flex flex-col gap-2">
        {items.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.name}</p>
                <p className="mt-1 whitespace-pre-line text-xs text-muted">{t.body}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setEditando(t)}>
                  Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(t.id)} className="text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Comunicação"
        description="Mensagens prontas pro WhatsApp. O sistema monta o texto — o envio é sempre você que faz."
        actions={
          <Button onClick={() => setCriando(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        }
      />

      <Card>
        <CardContent className="flex items-start gap-2 py-3 text-sm text-muted">
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
          <span>
            Nenhuma mensagem sai automaticamente. Ao clicar em WhatsApp numa lista, o app abre a conversa com o texto
            já preenchido e você decide se envia.
          </span>
        </CardContent>
      </Card>

      <Lista items={clientes} titulo="Clientes" />
      <Lista items={revenda} titulo="Revendedores" />

      {criando && <TemplateModal open onClose={() => setCriando(false)} />}
      {editando && <TemplateModal open onClose={() => setEditando(undefined)} template={editando} />}
    </div>
  );
}
