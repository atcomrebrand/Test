import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import { CameraOff, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  /** Fires once, with the decoded QR text. The modal stops the camera before calling it. */
  onDetected: (code: string) => void;
}

/**
 * Reads the QR code off a nota with the device camera.
 *
 * The camera is the part of this flow most likely to fail on a real phone, so every failure is
 * given its own message instead of a generic "erro": a denied permission, a missing camera and a
 * camera held by another app are three different problems with three different fixes, and the one
 * thing they share is that the user can always fall back to typing the 44-digit key by hand.
 */
export function QrScannerModal({ open, onClose, onDetected }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setError(null);
    setStarting(true);

    const scanner = new QrScanner(
      video,
      (result) => {
        // Stop before handing the code over: leaving the camera running behind the next screen
        // keeps the phone's camera light on and burns battery, and a second decode of the same
        // frame would fire the callback twice.
        scanner.stop();
        onDetected(result.data);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5, preferredCamera: "environment" },
    );
    scannerRef.current = scanner;

    scanner
      .start()
      .then(() => {
        if (!cancelled) setStarting(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStarting(false);
        setError(cameraErrorMessage(err));
      });

    return () => {
      cancelled = true;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <Modal open={open} onClose={onClose} title="Escanear a nota" size="md">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
          {/* playsInline is what keeps iOS Safari from taking the video fullscreen and hiding the
              rest of the screen; muted is required for autoplay to be allowed at all. */}
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />

          {starting && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Ligando a câmera…</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center text-white">
              <CameraOff className="h-7 w-7" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted">
          Aponte pro QR Code impresso no rodapé da nota fiscal. Ele é lido sozinho assim que ficar nítido.
        </p>

        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}

/** Maps what the browser actually throws into something that tells the user what to do about it. */
function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  const raw = err instanceof Error ? err.message : String(err);

  if (name === "NotAllowedError" || /permission|denied/i.test(raw)) {
    return "Você bloqueou o acesso à câmera. Libere nas permissões do site e tente de novo — ou digite a chave da nota à mão.";
  }
  if (name === "NotFoundError" || /no camera|not found/i.test(raw)) {
    return "Não achei nenhuma câmera nesse aparelho. Dá pra digitar a chave de 44 dígitos da nota.";
  }
  if (name === "NotReadableError") {
    return "A câmera está ocupada por outro app. Feche o outro app e tente de novo.";
  }
  if (location.protocol !== "https:" && location.hostname !== "localhost") {
    return "A câmera só funciona em HTTPS. Abra o site pelo endereço seguro, ou digite a chave da nota.";
  }
  return "Não consegui abrir a câmera. Digite a chave de 44 dígitos da nota.";
}
