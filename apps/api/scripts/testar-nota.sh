#!/usr/bin/env bash
#
# Testa o import de uma nota fiscal (NFC-e) de ponta a ponta contra a API em produção.
#
#   ./scripts/testar-nota.sh '<URL do QR Code da nota>'
#
# Existe como script — em vez de um bloco pra colar no terminal — porque colar comando
# multi-linha com aspas aninhadas no PuTTY embaralha as linhas e produz erros que não têm
# nada a ver com o que se quer testar.
#
# Só faz leitura: /notas/scan consulta a SEFAZ e devolve o que achou, sem gravar nada.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${API_BASE:-https://191-252-202-85.sslip.io}"
EMAIL="${EMAIL:-maurool.galvaoo@icloud.com}"
QR="${1:-}"

if [ -z "$QR" ]; then
  echo "uso: $0 '<URL do QR Code da nota>'" >&2
  echo "" >&2
  echo "A URL sai da câmera do celular ao escanear o QR da nota — é a que abre no navegador," >&2
  echo "inteira, com o ?p=... no final. Use aspas simples em volta." >&2
  exit 1
fi

# Toda travessia shell -> Python passa por sys.argv ou stdin, nunca por interpolação dentro de
# aspas: os.environ não enxerga variável de shell não exportada, e Python embutido entre aspas
# simples perde as próprias aspas simples. As duas coisas já quebraram este teste antes.
read -rsp "Senha de ${EMAIL}: " SENHA
echo

echo "==> Autenticando em ${BASE}"
LOGIN_PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))' "$EMAIL" "$SENHA")
LOGIN_RESPONSE=$(curl -sS -X POST "${BASE}/api/v1/auth/login" -H "Content-Type: application/json" -d "$LOGIN_PAYLOAD")
TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("data",{}).get("token",""))' 2>/dev/null || true)

if [ -z "$TOKEN" ]; then
  echo "!! Login falhou. Resposta da API:" >&2
  printf '%s\n' "$LOGIN_RESPONSE" >&2
  exit 1
fi
echo "    ok (token de ${#TOKEN} caracteres)"

echo "==> Consultando a nota na SEFAZ-SP (pode demorar alguns segundos)"
SCAN_PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"code": sys.argv[1]}))' "$QR")
SCAN_RESPONSE=$(curl -sS -X POST "${BASE}/api/v1/market/notas/scan" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d "$SCAN_PAYLOAD")

printf '%s' "$SCAN_RESPONSE" | python3 "${SCRIPT_DIR}/formatar-nota.py"
