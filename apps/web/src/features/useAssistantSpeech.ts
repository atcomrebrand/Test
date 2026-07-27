import { useCallback, useRef } from "react";
import { useAssistantVoiceStore } from "@/store/assistantVoice";
import { speak as speakWithBrowser, cancelSpeech, blobToDataUri } from "@/lib/speech";
import { synthesizeSpeech } from "./useAssistant";

/**
 * Single entry point both the floating chat and the Jarvis call mode use to speak a reply —
 * centralizes the browser-vs-ElevenLabs branching so neither caller needs to know which source is
 * active. Falls back to the free browser voice if ElevenLabs errors out (missing key, no credits,
 * network, or WebKit failing to play the audio) instead of leaving the caller (notably the
 * call-mode loop) stuck with no reply spoken. Also returns stop(), since cancelSpeech() alone only
 * silences speechSynthesis — an in-flight ElevenLabs <audio> needs its own reference to pause,
 * which callers can't reach on their own.
 */
export function useSpeakAssistantReply() {
  const voiceSource = useAssistantVoiceStore((s) => s.voiceSource);
  const voiceURI = useAssistantVoiceStore((s) => s.voiceURI);
  const elevenLabsVoiceId = useAssistantVoiceStore((s) => s.elevenLabsVoiceId);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakReply = useCallback(
    (text: string, onEnd?: () => void, onFallback?: (reason: string) => void) => {
      if (voiceSource === "elevenlabs" && elevenLabsVoiceId) {
        synthesizeSpeech(text, elevenLabsVoiceId)
          .then((blob) => blobToDataUri(blob))
          .then((dataUri) => {
            const audio = new Audio(dataUri);
            audioRef.current = audio;
            const finish = () => {
              if (audioRef.current === audio) audioRef.current = null;
              onEnd?.();
            };
            audio.onended = finish;
            audio.onerror = () => {
              if (audioRef.current === audio) audioRef.current = null;
              onFallback?.("elevenlabs-playback-erro");
              speakWithBrowser(text, onEnd, voiceURI);
            };
            audio.play().catch(() => {
              // Most likely the browser's autoplay policy blocking .play() this far removed from
              // the click that started the turn — surface it so the caller (the call-mode
              // caption) can tell the user what actually happened, and still speak via the free
              // browser voice instead of leaving the reply completely silent.
              if (audioRef.current === audio) audioRef.current = null;
              onFallback?.("audio-autoplay-bloqueado");
              speakWithBrowser(text, onEnd, voiceURI);
            });
          })
          .catch((err) => {
            onFallback?.(err instanceof Error ? err.message : "elevenlabs-erro");
            speakWithBrowser(text, onEnd, voiceURI);
          });
        return;
      }
      speakWithBrowser(text, onEnd, voiceURI);
    },
    [voiceSource, voiceURI, elevenLabsVoiceId],
  );

  const stop = useCallback(() => {
    cancelSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return { speakReply, stop };
}
