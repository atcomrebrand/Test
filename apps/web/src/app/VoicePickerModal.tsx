import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Check, Loader2, Play } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Tabs } from "@/components/ui/Tabs";
import { useAssistantVoiceStore, VoiceSource } from "@/store/assistantVoice";
import { getPreferredVoices, loadVoices, speak } from "@/lib/speech";
import { useElevenLabsVoices, synthesizeSpeech } from "@/features/useAssistant";

interface VoicePickerModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_TEXT = "Oi, eu sou o assistente do Ferramentas do Mauro.";

const SOURCE_OPTIONS = [
  { value: "browser", label: "Navegador (grátis)" },
  { value: "elevenlabs", label: "ElevenLabs (pago)" },
];

/** Lets you preview and pick either a free browser voice (speechSynthesis) or, if
 *  ELEVENLABS_API_KEY is configured on the server, a paid ElevenLabs voice — both funnel into the
 *  same voiceSource/voiceURI/elevenLabsVoiceId trio in the store that useSpeakAssistantReply reads. */
export function VoicePickerModal({ open, onClose }: VoicePickerModalProps) {
  const [tab, setTab] = useState<VoiceSource>("browser");
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const voiceSource = useAssistantVoiceStore((s) => s.voiceSource);
  const voiceURI = useAssistantVoiceStore((s) => s.voiceURI);
  const elevenLabsVoiceId = useAssistantVoiceStore((s) => s.elevenLabsVoiceId);
  const setVoiceSource = useAssistantVoiceStore((s) => s.setVoiceSource);
  const setVoiceURI = useAssistantVoiceStore((s) => s.setVoiceURI);
  const setElevenLabsVoiceId = useAssistantVoiceStore((s) => s.setElevenLabsVoiceId);

  const elevenLabsVoices = useElevenLabsVoices(open && tab === "elevenlabs");

  useEffect(() => {
    if (open) setTab(voiceSource);
  }, [open, voiceSource]);

  useEffect(() => {
    if (!open) return;
    loadVoices().then((all) => setBrowserVoices(getPreferredVoices(all)));
  }, [open]);

  function pickBrowserVoice(uri: string | null) {
    setVoiceSource("browser");
    setVoiceURI(uri);
  }

  function pickElevenLabsVoice(voiceId: string) {
    setVoiceSource("elevenlabs");
    setElevenLabsVoiceId(voiceId);
  }

  async function previewElevenLabsVoice(voiceId: string) {
    setPreviewingId(voiceId);
    try {
      const blob = await synthesizeSpeech(SAMPLE_TEXT, voiceId);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao testar essa voz.");
    } finally {
      setPreviewingId(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Voz do assistente" size="sm">
      <Tabs value={tab} onChange={(v) => setTab(v as VoiceSource)} options={SOURCE_OPTIONS} className="mb-3 w-full" />

      {tab === "browser" ? (
        <div className="space-y-1">
          <p className="px-1 pb-1 text-xs text-muted">
            Vozes com <span className="font-medium text-accent-600 dark:text-accent-300">"melhor qualidade"</span> costumam soar
            bem menos robotizadas — vale testar essas primeiro.
          </p>
          <button
            onClick={() => pickBrowserVoice(null)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              voiceSource === "browser" && voiceURI === null ? "bg-accent-500/10 text-accent-600 dark:text-accent-300" : "hover:surface-2"
            }`}
          >
            Padrão do navegador
            {voiceSource === "browser" && voiceURI === null && <Check className="h-4 w-4" />}
          </button>

          {browserVoices.map((v) => (
            <div
              key={v.voiceURI}
              className={`flex items-center justify-between rounded-xl px-1 py-1 text-sm transition-colors ${
                voiceSource === "browser" && voiceURI === v.voiceURI ? "bg-accent-500/10 text-accent-600 dark:text-accent-300" : "hover:surface-2"
              }`}
            >
              <button onClick={() => pickBrowserVoice(v.voiceURI)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left">
                {v.name} <span className="text-xs text-muted">({v.lang})</span>
                {!v.localService && (
                  <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                    melhor qualidade
                  </span>
                )}
              </button>
              <div className="flex shrink-0 items-center gap-1 pr-1">
                <button
                  onClick={() => speak(SAMPLE_TEXT, undefined, v.voiceURI)}
                  className="rounded-lg p-1.5 text-muted hover:surface-2"
                  aria-label={`Testar voz ${v.name}`}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                {voiceSource === "browser" && voiceURI === v.voiceURI && <Check className="h-4 w-4" />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {elevenLabsVoices.isLoading && (
            <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando vozes...
            </div>
          )}

          {elevenLabsVoices.isError && (
            <p className="px-1 py-2 text-sm text-muted">{elevenLabsVoices.error?.message ?? "Erro ao carregar vozes do ElevenLabs."}</p>
          )}

          {elevenLabsVoices.isSuccess && (
            <>
              <p className="px-1 pb-1 text-xs text-muted">Cada resposta falada com essas vozes consome créditos da sua conta ElevenLabs.</p>
              {elevenLabsVoices.data.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted">Nenhuma voz encontrada na sua conta ElevenLabs.</p>
              ) : (
                elevenLabsVoices.data.map((v) => (
                  <div
                    key={v.voiceId}
                    className={`flex items-center justify-between rounded-xl px-1 py-1 text-sm transition-colors ${
                      voiceSource === "elevenlabs" && elevenLabsVoiceId === v.voiceId
                        ? "bg-accent-500/10 text-accent-600 dark:text-accent-300"
                        : "hover:surface-2"
                    }`}
                  >
                    <button onClick={() => pickElevenLabsVoice(v.voiceId)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left">
                      {v.name}
                    </button>
                    <div className="flex shrink-0 items-center gap-1 pr-1">
                      <button
                        onClick={() => previewElevenLabsVoice(v.voiceId)}
                        disabled={previewingId === v.voiceId}
                        className="rounded-lg p-1.5 text-muted hover:surface-2 disabled:opacity-50"
                        aria-label={`Testar voz ${v.name}`}
                      >
                        {previewingId === v.voiceId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      </button>
                      {voiceSource === "elevenlabs" && elevenLabsVoiceId === v.voiceId && <Check className="h-4 w-4" />}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
