"""Formata a resposta de /market/notas/scan em algo legível no terminal.

Arquivo separado, e não um `python3 -c '...'` embutido no shell script, porque Python precisa de
aspas simples (nota.get('storeName'), item['quantity']) e o shell as consome quando o bloco inteiro
está entre aspas simples — o script recebia nota.get(storeName) e morria com NameError. Num arquivo
não existe camada de quoting pra atrapalhar, e dá pra testar isto de verdade, sozinho.

Lê o JSON da resposta em stdin. Sai com código 1 quando a API recusou a nota, pra o script chamador
poder distinguir sucesso de falha.
"""

import json
import sys


def main() -> int:
    raw = sys.stdin.read()

    try:
        body = json.loads(raw)
    except ValueError:
        print("A resposta não era JSON. Primeiros 2000 caracteres:")
        print(raw[:2000])
        return 1

    if not body.get("success", True) or "data" not in body:
        print("A API recusou a nota:")
        print(json.dumps(body, indent=2, ensure_ascii=False))
        return 1

    nota = body["data"]
    items = nota.get("items", [])
    confere = "NAO - alguma linha da nota nao foi lida" if nota.get("totalsMismatch") else "sim"
    tributos = nota.get("taxAmount")
    tributos_txt = "nao declarado nessa nota" if tributos is None else "{} (aproximado, Lei 12.741)".format(tributos)

    print("")
    print("  Loja        : {}".format(nota.get("storeName")))
    print("  CNPJ        : {}".format(nota.get("storeCnpj")))
    print("  Data        : {}".format(nota.get("purchaseDate")))
    print("  Total da NF : {}".format(nota.get("totalAmount")))
    print("  Soma itens  : {}".format(nota.get("itemsTotal")))
    print("  Confere?    : {}".format(confere))
    print("  Tributos    : {}".format(tributos_txt))
    print("  Itens lidos : {}".format(len(items)))
    print("")

    if not items:
        print("  Nenhum item foi lido — o parser não reconheceu a estrutura da página.")
        return 1

    print("  Primeiros 10 itens:")
    for item in items[:10]:
        print(
            "    {:>9} {:<4} x {:>10} = {:>10}  {}".format(
                item.get("quantity"),
                item.get("unit"),
                item.get("unitPrice"),
                item.get("totalPrice"),
                item.get("description"),
            )
        )
    if len(items) > 10:
        print("    ... e mais {} itens".format(len(items) - 10))

    return 0


if __name__ == "__main__":
    sys.exit(main())
