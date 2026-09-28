#!/usr/bin/env bash
#
# Lista — e, só quando explicitamente mandado, apaga — as contas de teste do banco de produção.
#
#   ./scripts/limpar-usuarios.sh                    # só lista, não apaga nada
#   ./scripts/limpar-usuarios.sh --apagar           # apaga, depois de fazer backup
#   MANTER=outro@email.com ./scripts/limpar-usuarios.sh
#
# Apagar um usuário leva junto TUDO dele: as 36 tabelas filhas de User têm onDelete: Cascade —
# cartões, compras, parcelas, investimentos, horas, contas da casa, mercado. Não tem desfazer.
# Por isso o padrão é listar: dá pra ver exatamente quem morre e quanto dado vai junto antes de
# decidir. O --apagar tira um dump antes de encostar em qualquer linha.
set -euo pipefail

MANTER="${MANTER:-maurool.galvaoo@icloud.com}"
MODO="${1:---listar}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
DB=$(grep -oP 'DATABASE_URL="postgresql://[^/]+/\K[^?"]+' .env)
[ -n "$DB" ] || { echo "!! Não achei o nome do banco na DATABASE_URL do .env" >&2; exit 1; }

# Sem `command` aqui: ele é builtin do bash, e o sudo tentaria executar um programa com esse nome.
# A recursão que o `command` costuma evitar não acontece — o sudo exec um processo novo, que não
# enxerga esta função.
# -P pager=off: sem isso o psql joga a listagem no `less`, que para em "(END)" esperando um `q`.
# Num terminal SSH isso parece a sessão ter travado, e impede rolar pra cima e copiar a tabela —
# que é justamente o que se precisa fazer com ela antes de decidir apagar alguma coisa.
psql() { sudo -u postgres psql -P pager=off -d "$DB" "$@"; }

# Uma linha por usuário com o volume de dados de cada módulo, pra conta real não ser confundida
# com conta de teste por causa do nome do e-mail.
LISTAGEM="
select u.email,
       to_char(u.\"createdAt\", 'DD/MM/YYYY') as criado,
       (select count(*) from purchases        where \"userId\" = u.id) as compras,
       (select count(*) from cards            where \"userId\" = u.id) as cartoes,
       (select count(*) from investment_assets where \"userId\" = u.id) as ativos,
       (select count(*) from tracking_sessions where \"userId\" = u.id) as sessoes,
       (select count(*) from household_bills   where \"userId\" = u.id) as contas_casa,
       (select count(*) from market_purchases  where \"userId\" = u.id) as notas,
       case when u.email = '${MANTER}' then 'MANTER' else 'apagar' end as destino
from users u
order by (u.email = '${MANTER}') desc, u.\"createdAt\";"

echo "==> Banco: ${DB}   |   conta preservada: ${MANTER}"
echo
psql -c "$LISTAGEM"

if [ "$MODO" != "--apagar" ]; then
  echo "Nada foi apagado — isto é só a listagem."
  echo "Confira a coluna 'destino'. Se estiver certo, rode de novo com --apagar."
  exit 0
fi

# A partir daqui a coisa é destrutiva.
if ! psql -tAc "select 1 from users where email = '${MANTER}'" | grep -q 1; then
  echo "!! A conta a preservar (${MANTER}) não existe nesse banco. Abortando antes de apagar o resto." >&2
  exit 1
fi

BACKUP="/root/backup-antes-limpeza-$(date +%Y%m%d-%H%M%S).sql"
echo "==> Backup em ${BACKUP}"
sudo -u postgres pg_dump "$DB" > "$BACKUP" || true

# Explícito de propósito, e não deixado por conta do `set -e`: um backup que falhou silenciosamente
# transforma "operação com rede de segurança" em "delete sem volta", e a diferença entre as duas
# não pode depender de ninguém lembrar que pipefail estava ligado.
if [ ! -s "$BACKUP" ] || ! grep -q "PostgreSQL database dump" "$BACKUP"; then
  echo "!! O backup não foi gravado direito. Abortando — nada foi apagado." >&2
  exit 1
fi
echo "    ok ($(du -h "$BACKUP" | cut -f1))"

echo
read -rp "Apagar TODAS as contas acima marcadas 'apagar', com todos os dados delas? (digite APAGAR) " RESPOSTA
[ "$RESPOSTA" = "APAGAR" ] || { echo "Cancelado. Nada foi apagado."; exit 0; }

echo "==> Apagando"
psql -c "delete from users where email <> '${MANTER}';"

echo
echo "==> Sobrou:"
psql -c "$LISTAGEM"
echo "Se der ruim: sudo -u postgres psql -d ${DB} < ${BACKUP}"
