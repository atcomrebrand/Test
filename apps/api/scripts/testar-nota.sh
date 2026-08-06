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
# Só faz leitura: o endpoint /notas/scan consulta a SEFAZ e devolve o que achou, sem gravar nada.
set -euo pipefail

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

# sys.argv em vez de os.environ: variável de shell não exportada não chega no ambiente do
# processo filho, que foi exatamente o que quebrou a primeira tentativa desse teste.
json_field() { python3 -c 'import json,sys; print(json.dumps({sys.argv[1]: sys.argv[2]}))' "$1" "$2"; }

read -rsp "Senha de ${EMAIL}: " SENHA
echo

echo "==> Autenticando em ${BASE}"
LOGIN_PAYLOAD=$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))' "$EMAIL" "$SENHA")
LOGIN_RESPONSE=$(curl -sS -X POST "${BASE}/api/v1/auth/login" -H "Content-Type: application/json" -d "$LOGIN_PAYLOAD")

TOKEN=$(printf '%s' "$LOGIN_RESPONSE" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit("")
print(data.get("data", {}).get("token", ""))
' || true)

if [ -z "$TOKEN" ]; then
  echo "!! Login falhou. Resposta da API:" >&2
  printf '%s\n' "$LOGIN_RESPONSE" >&2
  exit 1
fi
echo "    ok (token de ${#TOKEN} caracteres)"

echo "==> Consultando a nota na SEFAZ-SP (pode demorar alguns segundos)"
SCAN_PAYLOAD=$(json_field code "$QR")
SCAN_RESPONSE=$(curl -sS -X POST "${BASE}/api/v1/market/notas/scan" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d "$SCAN_PAYLOAD")

printf '%s' "$SCAN_RESPONSE" | python3 -c '
import json, sys

raw = sys.stdin.read()
try:
    body = json.loads(raw)
except Exception:
    print("Resposta não era JSON:")
    print(raw[:2000])
    sys.exit(1)

if not body.get("success", True) or "data" not in body:
    print("A API recusou a nota:")
    print(json.dumps(body, indent=2, ensure_ascii=False))
    sys.exit(1)

nota = body["data"]
items = nota.get("items", [])
confere = "NAO - alguma linha nao foi lida" if nota.get("totalsMismatch") else "sim"
print("")
print(f"  Loja        : {nota.get('storeName')}")
print(f"  CNPJ        : {nota.get('storeCnpj')}")
print(f"  Data        : {nota.get('purchaseDate')}")
print(f"  Total da NF : {nota.get('totalAmount')}")
print(f"  Soma itens  : {nota.get('itemsTotal')}")
print(f"  Confere?    : {confere}")
print(f"  Itens lidos : {len(items)}")
print("")
print("  Primeiros 10 itens:")
for item in items[:10]:
    print(f"    {item['quantity']:>8} {item['unit']:<4} x {item['unitPrice']:>9} = {item['totalPrice']:>9}  {item['description']}")
if len(items) > 10:
    print(f"    ... e mais {len(items) - 10} itens")
'
