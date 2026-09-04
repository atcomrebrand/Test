import { useCallback, useRef } from "react";
import { useAssistantVoiceStore } from "@/store/assistantVoice";
import { speak as speakWithBrowser, cancelSpeech, playAudioBlob } from "@/lib/speech";
import { synthesizeSpeech } from "./useAssistant";

/**
 * Single entry point both the floating chat and the Jarvis call mode use to speak a reply —
 * centralizes the browser-vs-ElevenLabs branching so neither caller needs to know which source is
 * active. Falls back to the free browser voice if ElevenLabs errors out (missing key, no credits,
 * network, or the audio failing to decode/play) instead of leaving the caller (notably the
 * call-mode loop) stuck with no reply spoken. Also returns stop(), since cancelSpeech() alone only
 * silences speechSynthesis — an in-flight ElevenLabs playback needs its own reference to cancel,
 * which callers can't reach on their own.
 */
export function useSpeakAssistantReply() {
  const voiceSource = useAssistantVoiceStore((s) => s.voiceSource);
  const voiceURI = useAssistantVoiceStore((s) => s.voiceURI);
  const elevenLabsVoiceId = useAssistantVoiceStore((s) => s.elevenLabsVoiceId);
  const stopAudioRef = useRef<(() => void) | null>(null);

  const speakReply = useCallback(
    (text: string, onEnd?: () => void, onFallback?: (reason: string) => void, onStart?: (durationMs: number) => void) => {
      if (voiceSource === "elevenlabs" && elevenLabsVoiceId) {
        synthesizeSpeech(text, elevenLabsVoiceId)
          .then((blob) => {
            stopAudioRef.current = playAudioBlob(
              blob,
              () => {
                stopAudioRef.current = null;
                onEnd?.();
              },
              (err) => {
                stopAudioRef.current = null;
                onFallback?.(err instanceof Error ? err.message : "elevenlabs-playback-erro");
                speakWithBrowser(text, onEnd, voiceURI, onStart);
              },
              onStart,
            );
          })
          .catch((err) => {
            onFallback?.(err instanceof Error ? err.message : "elevenlabs-erro");
            speakWithBrowser(text, onEnd, voiceURI, onStart);
          });
        return;
      }
      speakWithBrowser(text, onEnd, voiceURI, onStart);
    },
    [voiceSource, voiceURI, elevenLabsVoiceId],
  );

  const stop = useCallback(() => {
    cancelSpeech();
    stopAudioRef.current?.();
    stopAudioRef.current = null;
  }, []);

  return { speakReply, stop };
}
