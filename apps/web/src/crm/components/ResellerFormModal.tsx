import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useCreateCrmReseller, useCrmPortfolioId, useCrmPortfolios, useUpdateCrmReseller } from "../api";
import { CrmReseller } from "../types";

/** Cadastro do revendedor. Já cria o vínculo com um serviço e o preço do crédito — sem preço a
 *  recarga rápida não teria de onde tirar o valor e viraria formulário. */
export function ResellerFormModal({
  open,
  onClose,
  reseller,
}: {
  open: boolean;
  onClose: () => void;
  reseller?: CrmReseller;
}) {
  const { data: portfolios } = useCrmPortfolios();
  const selected = useCrmPortfolioId();
  const create = useCreateCrmReseller();
  const update = useUpdateCrmReseller();

  const [form, setForm] = useState({
    name: "",
    companyName: "",
    phone: "",
    whatsapp: "",
    email: "",
    notes: "",
    portfolioId: "",
    creditPrice: "5",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: reseller?.name ?? "",
      companyName: reseller?.companyName ?? "",
      phone: reseller?.phone ?? "",
      whatsapp: reseller?.whatsapp ?? "",
      email: reseller?.email ?? "",
      notes: reseller?.notes ?? "",
      portfolioId: selected ?? portfolios?.[0]?.id ?? "",
      creditPrice: "5",
    });
  }, [open, reseller, selected, portfolios]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const base = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      companyName: form.companyName.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    const done = () => onClose();

    if (reseller) update.mutate({ id: reseller.id, data: base }, { onSuccess: done });
    else
      create.mutate(
        { ...base, portfolioId: form.portfolioId, creditPrice: Number(form.creditPrice) },
        { onSuccess: done },
      );
  };

  return (
    <Modal open={open} onClose={onClose} title={reseller ? "Editar revendedor" : "Novo revendedor"} size="lg">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input
            label="Nome comercial"
            value={form.companyName}
            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
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
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        {!reseller && (
          <>
            <div className="h-px bg-[rgb(var(--border))]" />
            <p className="text-xs text-muted">
              Vínculo comercial — créditos e estimativa de clientes são por serviço. Dá pra adicionar o outro depois,
              no perfil.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Serviço"
                value={form.portfolioId}
                onChange={(e) => setForm({ ...form, portfolioId: e.target.value })}
                options={(portfolios ?? []).map((p) => ({ value: p.id, label: p.name }))}
                required
              />
              <Input
                label="Preço do crédito"
                type="number"
                step="0.01"
                min="0"
                value={form.creditPrice}
                onChange={(e) => setForm({ ...form, creditPrice: e.target.value })}
              />
            </div>
          </>
        )}

        <Input
          label="Observações comerciais"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={create.isPending || update.isPending}>
            {reseller ? "Salvar" : "Cadastrar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
