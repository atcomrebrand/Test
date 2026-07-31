import { FormEvent, useState } from "react";
import toast from "react-hot-toast";
import { Brain, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAssistantMemories, useCreateAssistantMemory, useDeleteAssistantMemory } from "@/features/useAssistantMemory";

/** Lets the user see, add, and remove what the assistant remembers about them — the same list it
 *  injects into every chat, and the same list its own lembrar/esquecer tools read and write
 *  during a conversation. Managing it here is just the direct, no-conversation-needed path. */
export function AssistantMemoryCard() {
  const { data: memories, isLoading } = useAssistantMemories();
  const createMemory = useCreateAssistantMemory();
  const deleteMemory = useDeleteAssistantMemory();
  const [content, setContent] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    createMemory.mutate(trimmed, {
      onSuccess: () => setContent(""),
      onError: () => toast.error("Não consegui salvar essa memória."),
    });
  }

  function handleDelete(id: string) {
    deleteMemory.mutate(id, { onError: () => toast.error("Não consegui apagar essa memória.") });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-4 w-4" /> Memória do assistente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Fatos, crenças e preferências suas que o assistente guarda e leva em conta em toda conversa — pode contar diretamente pra ele durante o
          chat ("lembra que eu prefiro X") ou adicionar aqui.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ex: prefiro respostas diretas, sem rodeio."
            rows={2}
            className="flex-1"
          />
          <Button type="submit" loading={createMemory.isPending} disabled={!content.trim()}>
            Salvar
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : !memories || memories.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma memória salva ainda.</p>
        ) : (
          <ul className="space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[rgb(var(--border))] surface-2 px-3 py-2.5 text-sm"
              >
                <span className="flex-1">{memory.content}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(memory.id)}
                  disabled={deleteMemory.isPending}
                  className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Esquecer essa memória"
                  title="Esquecer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
