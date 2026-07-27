import { useEffect, useState } from "react";
import { Check, Play } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useAssistantVoiceStore } from "@/store/assistantVoice";
import { getPreferredVoices, loadVoices, speak } from "@/lib/speech";

interface VoicePickerModalProps {
  open: boolean;
  onClose: () => void;
}

const SAMPLE_TEXT = "Oi, eu sou o assistente do Ferramentas do Mauro.";

/** Lists the voices speechSynthesis found installed on this device/browser — availability varies
 *  wildly (Android's Google TTS ships several pt-BR voices, desktop Chrome/Edge use OS voices,
 *  Safari uses macOS/iOS ones), so this reads whatever's actually there instead of hardcoding names. */
export function VoicePickerModal({ open, onClose }: VoicePickerModalProps) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const voiceURI = useAssistantVoiceStore((s) => s.voiceURI);
  const setVoiceURI = useAssistantVoiceStore((s) => s.setVoiceURI);

  useEffect(() => {
    if (!open) return;
    loadVoices().then((all) => setVoices(getPreferredVoices(all)));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Voz do assistente" size="sm">
      {voices.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma voz encontrada nesse navegador.</p>
      ) : (
        <div className="space-y-1">
          <button
            onClick={() => setVoiceURI(null)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
              voiceURI === null ? "bg-accent-500/10 text-accent-600 dark:text-accent-300" : "hover:surface-2"
            }`}
          >
            Padrão do navegador
            {voiceURI === null && <Check className="h-4 w-4" />}
          </button>

          {voices.map((v) => (
            <div
              key={v.voiceURI}
              className={`flex items-center justify-between rounded-xl px-1 py-1 text-sm transition-colors ${
                voiceURI === v.voiceURI ? "bg-accent-500/10 text-accent-600 dark:text-accent-300" : "hover:surface-2"
              }`}
            >
              <button onClick={() => setVoiceURI(v.voiceURI)} className="min-w-0 flex-1 truncate px-2 py-1.5 text-left">
                {v.name} <span className="text-xs text-muted">({v.lang})</span>
              </button>
              <div className="flex shrink-0 items-center gap-1 pr-1">
                <button
                  onClick={() => speak(SAMPLE_TEXT, undefined, v.voiceURI)}
                  className="rounded-lg p-1.5 text-muted hover:surface-2"
                  aria-label={`Testar voz ${v.name}`}
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                {voiceURI === v.voiceURI && <Check className="h-4 w-4" />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
