#!/usr/bin/env bash
#
# Mostra o HTML cru de um trecho da página de consulta da NFC-e, pra descobrir a estrutura real
# antes de escrever parser em cima de suposição.
#
#   ./scripts/ver-trecho-nota.sh '<URL do QR>' tribut
#   ./scripts/ver-trecho-nota.sh '<URL do QR>' 'Vl. Total'
#
# Vai direto na SEFAZ, sem passar pela API — é só leitura de página pública.
set -euo pipefail

QR="${1:-}"
TERMO="${2:-tribut}"
CONTEXTO="${3:-6}"

if [ -z "$QR" ]; then
  echo "uso: $0 '<URL do QR Code da nota>' [termo] [linhas de contexto]" >&2
  exit 1
fi

UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

echo "==> Buscando a nota e procurando por '${TERMO}'"
echo ""

# Sem transcodificar: a página da SEFAZ-SP já vem em UTF-8 (confirmado em 2026-08). A versão
# anterior deste script passava por `iconv -f ISO-8859-1`, e foi justamente isso que fez
# "Informação" sair como "InformaÃ§Ã£o" no primeiro dump — reencodando UTF-8 que já estava certo.
curl -sS "$QR" -H "User-Agent: ${UA}" \
  | grep -i -B "$CONTEXTO" -A "$CONTEXTO" "$TERMO" \
  | head -80
