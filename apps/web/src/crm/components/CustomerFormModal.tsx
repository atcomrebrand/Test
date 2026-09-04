import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  useCreateCrmCustomer,
  useCrmOrigins,
  useCrmPortfolios,
  useCrmPortfolioId,
  useUpdateCrmCustomer,
} from "../api";
import { CrmCustomer } from "../types";

/**
 * Cadastro de cliente. Só nome, telefone e serviço são obrigatórios (§7) — exigir CPF e e-mail de
 * quem chegou pelo WhatsApp faria o cadastro travar no meio, e o dado que falta é sempre o que
 * ninguém volta pra preencher.
 *
 * O serviço vem pré-selecionado do seletor global, mas continua visível e editável: é a última
 * barreira contra cadastrar no portfólio errado (§2).
 */
export function CustomerFormModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer?: CrmCustomer;
}) {
  const { data: portfolios } = useCrmPortfolios();
  const { data: origins } = useCrmOrigins();
  const selectedPortfolio = useCrmPortfolioId();
  const create = useCreateCrmCustomer();
  const update = useUpdateCrmCustomer();

  const [form, setForm] = useState({
    portfolioId: "",
    name: "",
    nickname: "",
    phone: "",
    whatsapp: "",
    email: "",
    document: "",
    originId: "",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      portfolioId: customer?.portfolioId ?? selectedPortfolio ?? portfolios?.[0]?.id ?? "",
      name: customer?.name ?? "",
      nickname: customer?.nickname ?? "",
      phone: customer?.phone ?? "",
      whatsapp: customer?.whatsapp ?? "",
      email: customer?.email ?? "",
      document: customer?.document ?? "",
      originId: customer?.originId ?? "",
      notes: customer?.notes ?? "",
    });
  }, [open, customer, selectedPortfolio, portfolios]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Campos vazios viram undefined em vez de "": string vazia gravaria um e-mail em branco que
    // depois aparece como se existisse.
    const payload = {
      portfolioId: form.portfolioId,
      name: form.name.trim(),
      phone: form.phone.trim(),
      nickname: form.nickname.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      email: form.email.trim() || undefined,
      document: form.document.trim() || undefined,
      originId: form.originId || undefined,
      notes: form.notes.trim() || undefined,
    };

    const done = () => onClose();
    if (customer) update.mutate({ id: customer.id, data: payload }, { onSuccess: done });
    else create.mutate(payload, { onSuccess: done });
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? "Editar cliente" : "Novo cliente"} size="lg">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Select
          label="Serviço"
          value={form.portfolioId}
          onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}
          options={(portfolios ?? []).map((p) => ({ value: p.id, label: p.name }))}
          required
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={1}
          />
          <Input
            label="Apelido"
            placeholder="Como você chama ele"
            value={form.nickname}
            onChange={(e) => setForm({ ...form, nickname: e.target.value })}
          />
          <Input
            label="Telefone"
            placeholder="(11) 98765-4321"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
          <Input
            label="WhatsApp"
            placeholder="Se for diferente do telefone"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="CPF"
            value={form.document}
            onChange={(e) => setForm({ ...form, document: e.target.value })}
          />
        </div>

        <Select
          label="Origem"
          value={form.originId}
          onChange={(e) => setForm({ ...form, originId: e.target.value })}
          options={[{ value: "", label: "Sem origem" }, ...(origins ?? []).map((o) => ({ value: o.id, label: o.name }))]}
        />

        <Input
          label="Observações"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {customer ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
