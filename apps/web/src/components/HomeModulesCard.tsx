import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { orderModules } from "@/app/homeModules";
import { APPS } from "@/pages/Home";
import { useSettings, useUpdateSettings } from "@/features/useSettings";

/**
 * Reordenar os módulos da Home.
 *
 * A ordem é guardada na CONTA, não no aparelho (como o tema e o modo privacidade): quais
 * ferramentas você usa mais é uma preferência sua, não do celular — arrastar no telefone e achar a
 * ordem antiga no computador seria o mesmo trabalho duas vezes.
 *
 * O salvamento é explícito, num botão. Gravar a cada pixel de arrasto seria uma requisição por
 * quadro, e salvar ao soltar deixaria a pessoa sem como desistir no meio.
 */
export function HomeModulesCard() {
  const { data: settings } = useSettings();
  const salvar = useUpdateSettings();
  const [ordem, setOrdem] = useState(APPS);
  const [mexeu, setMexeu] = useState(false);

  // Só sincroniza com o servidor enquanto a pessoa não mexeu — senão uma revalidação em segundo
  // plano desfaria o arrasto no meio.
  useEffect(() => {
    if (mexeu) return;
    setOrdem(orderModules(APPS, settings?.homeModules));
  }, [settings?.homeModules, mexeu]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ordem dos módulos na Home</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted">
          Arraste para escolher em que ordem as ferramentas aparecem. Ferramenta nova entra no fim da
          lista.
        </p>

        <Reorder.Group
          axis="y"
          values={ordem}
          onReorder={(nova) => {
            setOrdem(nova);
            setMexeu(true);
          }}
          className="flex flex-col gap-2"
        >
          {ordem.map((app) => (
            <Reorder.Item key={app.to} value={app}>
              <div className="flex cursor-grab items-center gap-3 rounded-xl border border-[rgb(var(--border))] surface px-3 py-2.5 active:cursor-grabbing">
                <GripVertical className="h-4 w-4 shrink-0 text-muted" />
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${app.color}`}>
                  <app.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{app.title}</span>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <div className="mt-4 flex gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setOrdem(APPS);
              setMexeu(true);
            }}
          >
            <RotateCcw className="h-4 w-4" />
            Ordem padrão
          </Button>
          <Button
            className="flex-1"
            disabled={!mexeu}
            loading={salvar.isPending}
            onClick={() =>
              salvar.mutate(
                { homeModules: ordem.map((a) => a.to) },
                { onSuccess: () => setMexeu(false) },
              )
            }
          >
            Salvar ordem
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
