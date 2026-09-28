import { Injectable, InternalServerErrorException, ServiceUnavailableException } from "@nestjs/common";

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  previewUrl: string | null;
}

// Half the per-character cost of eleven_multilingual_v2 and built for low-latency conversational
// use — the right tradeoff here since every reply already waits on a Claude round-trip first.
const TTS_MODEL = "eleven_flash_v2_5";

/** Optional paid upgrade over the free browser voices (Web Speech API) — genuinely natural-
 *  sounding TTS via ElevenLabs. Both methods throw ServiceUnavailableException when no key is
 *  configured, so the controller/frontend degrade the same way the chat assistant does when
 *  ANTHROPIC_API_KEY is missing: a clear response, never a silent failure. */
@Injectable()
export class ElevenLabsProvider {
  private readonly apiKey = process.env.ELEVENLABS_API_KEY;

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async listVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) throw new ServiceUnavailableException("ElevenLabs não configurado — falta ELEVENLABS_API_KEY no servidor.");

    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": this.apiKey },
    });
    if (!res.ok) throw new InternalServerErrorException(`Erro ao listar vozes do ElevenLabs (${res.status}).`);

    const body = (await res.json()) as { voices: { voice_id: string; name: string; preview_url?: string | null }[] };
    return body.voices.map((v) => ({ voiceId: v.voice_id, name: v.name, previewUrl: v.preview_url ?? null }));
  }

  async synthesize(text: string, voiceId: string): Promise<Buffer> {
    if (!this.apiKey) throw new ServiceUnavailableException("ElevenLabs não configurado — falta ELEVENLABS_API_KEY no servidor.");

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: TTS_MODEL }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 401 && /quota_exceeded/i.test(detail)) {
        throw new ServiceUnavailableException("Sem créditos no ElevenLabs — adicione créditos em elevenlabs.io pra voltar a usar essa voz.");
      }
      if (res.status === 401) throw new ServiceUnavailableException("Chave do ElevenLabs inválida ou expirada.");
      if (res.status === 429) throw new ServiceUnavailableException("Limite de uso do ElevenLabs atingido — tenta de novo daqui a pouco.");
      throw new InternalServerErrorException(`Erro ao gerar áudio no ElevenLabs (${res.status}): ${detail.slice(0, 300)}`);
    }

    return Buffer.from(await res.arrayBuffer());
  }
}
