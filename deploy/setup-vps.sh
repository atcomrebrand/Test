#!/usr/bin/env bash
#
# Instalador completo do "Parcelas" (gestão de cartão de crédito) em uma VPS Ubuntu/Debian limpa.
# Uso (como root): curl -fsSL <raw-url-deste-arquivo> | bash
#
# O que este script faz:
#   1. Instala Node.js 20 LTS, PostgreSQL, Nginx e ferramentas básicas.
#   2. Cria um usuário de sistema dedicado ("parcelas") para rodar a aplicação (não como root).
#   3. Cria o banco de dados PostgreSQL com uma senha gerada aleatoriamente.
#   4. Clona o repositório em /opt/parcelas e faz o build do backend (NestJS) e do frontend (Vite).
#   5. Roda as migrations do Prisma e popula o banco com dados de demonstração.
#   6. Configura o backend como serviço systemd (reinicia sozinho se cair ou se o servidor reiniciar).
#   7. Configura o Nginx com HTTPS (Let's Encrypt) num hostname sslip.io gratuito — sem precisar
#      comprar domínio — e faz proxy de /api/v1 para o backend. HTTPS é obrigatório para Face ID
#      (WebAuthn) e notificações push funcionarem no navegador; não tem como contornar isso.
#   8. Configura o firewall (ufw) liberando apenas SSH, HTTP e HTTPS.
#
# Idempotente: pode rodar de novo com segurança (ex: para atualizar após um novo `git push`).

set -euo pipefail

REPO_URL="https://github.com/atcomrebrand/test.git"
REPO_BRANCH="claude/credit-card-installments-system-8o6tq0"
APP_DIR="/opt/parcelas"
APP_USER="parcelas"
DB_NAME="creditcard_prod"
DB_USER="cc_app"
API_PORT="3333"
ENV_FILE="$APP_DIR/apps/api/.env"
ACME_WEBROOT="/var/www/certbot"

log() { echo -e "\n\033[1;36m==> $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode este script como root (ex: sudo bash setup-vps.sh)." >&2
  exit 1
fi

SERVER_IP="$(curl -fsSL -4 https://ifconfig.me || hostname -I | awk '{print $1}')"
# sslip.io resolve "1-2-3-4.sslip.io" para 1.2.3.4 automaticamente (sem cadastro, sem propagação
# de DNS) — dá um hostname real e público de graça, o suficiente para o Let's Encrypt emitir um
# certificado válido. Se o IP da VPS mudar um dia, esse hostname muda junto.
SSLIP_HOST="${SERVER_IP//./-}.sslip.io"

log "1/9 — Atualizando pacotes e instalando dependências do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git build-essential ufw nginx postgresql postgresql-contrib ca-certificates gnupg certbot

log "2/9 — Instalando Node.js 20 LTS"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pnpm@10 --silent
node -v
pnpm -v

log "3/9 — Criando usuário de sistema '$APP_USER'"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "$APP_USER"
fi

log "4/9 — Configurando PostgreSQL"
systemctl enable --now postgresql
if [ ! -f /root/.parcelas_db_password ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  echo "$DB_PASSWORD" > /root/.parcelas_db_password
  chmod 600 /root/.parcelas_db_password
else
  DB_PASSWORD="$(cat /root/.parcelas_db_password)"
fi

sudo -u postgres psql -v ON_ERROR_STOP=1 <<-SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASSWORD' CREATEDB;
  ELSE
    ALTER ROLE $DB_USER WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec
SQL

log "5/9 — Clonando/atualizando o repositório em $APP_DIR"
# Depois da 1a instalação, $APP_DIR pertence a $APP_USER; git (rodando aqui como root)
# recusa operar num diretório de outro dono a menos que ele seja marcado como confiável.
git config --global --add safe.directory "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin "$REPO_BRANCH"
  git -C "$APP_DIR" checkout "$REPO_BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$REPO_BRANCH"
else
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

log "6/9 — Configurando variáveis de ambiente"
if [ ! -f /root/.parcelas_jwt_secret ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  echo "$JWT_SECRET" > /root/.parcelas_jwt_secret
  chmod 600 /root/.parcelas_jwt_secret
else
  JWT_SECRET="$(cat /root/.parcelas_jwt_secret)"
fi

# BRAPI_TOKEN é opcional: sem ele a API de cotações (brapi.dev) funciona, só que com um rate
# limit bem mais apertado no tier gratuito. Passe a sua (cadastro grátis em brapi.dev) na hora
# de rodar o script — nunca fica hardcoded aqui nem no repositório, só persistida localmente
# nesta VPS pra reexecuções futuras não precisarem informá-la de novo:
#   BRAPI_TOKEN=sua_chave_aqui bash -c "$(curl -fsSL <raw-url-deste-arquivo>)"
if [ -n "${BRAPI_TOKEN:-}" ]; then
  echo "$BRAPI_TOKEN" > /root/.parcelas_brapi_token
  chmod 600 /root/.parcelas_brapi_token
elif [ -f /root/.parcelas_brapi_token ]; then
  BRAPI_TOKEN="$(cat /root/.parcelas_brapi_token)"
fi

# Chaves VAPID (notificações push): geradas uma única vez e reaproveitadas em toda reexecução —
# trocar essas chaves invalidaria todas as inscrições de push já feitas pelos aparelhos. Geradas
# com o crypto nativo do Node (mesmo algoritmo que a lib "web-push" usa por baixo dos panos —
# ECDH sobre prime256v1) para não depender do node_modules do app, que ainda não existe neste
# ponto do script (só é instalado no passo 7).
if [ ! -f /root/.parcelas_vapid_public ]; then
  VAPID_JSON="$(node -e "
    const crypto = require('crypto');
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const b64url = (buf) => buf.toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+\$/,'');
    // getPrivateKey() omits leading zero bytes instead of zero-padding to the curve's 32-byte
    // field size — pad it back or the private key material is silently wrong.
    const rawPriv = ecdh.getPrivateKey();
    const priv = rawPriv.length === 32 ? rawPriv : Buffer.concat([Buffer.alloc(32 - rawPriv.length), rawPriv]);
    console.log(JSON.stringify({ publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv) }));
  ")"
  echo "$VAPID_JSON" | node -e "const k=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(k.publicKey)" > /root/.parcelas_vapid_public
  echo "$VAPID_JSON" | node -e "const k=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(k.privateKey)" > /root/.parcelas_vapid_private
  chmod 600 /root/.parcelas_vapid_public /root/.parcelas_vapid_private
fi
VAPID_PUBLIC_KEY="$(cat /root/.parcelas_vapid_public)"
VAPID_PRIVATE_KEY="$(cat /root/.parcelas_vapid_private)"

# LETSENCRYPT_EMAIL é opcional (só recebe avisos de expiração/renovação do certificado — a
# renovação automática em si não depende disso). Nunca fica hardcoded aqui nem no repositório,
# mesmo padrão do BRAPI_TOKEN: passe na hora de rodar e fica persistida localmente nesta VPS.
#   LETSENCRYPT_EMAIL=seu-email@exemplo.com bash -c "$(curl -fsSL <raw-url-deste-arquivo>)"
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  echo "$LETSENCRYPT_EMAIL" > /root/.parcelas_letsencrypt_email
  chmod 600 /root/.parcelas_letsencrypt_email
elif [ -f /root/.parcelas_letsencrypt_email ]; then
  LETSENCRYPT_EMAIL="$(cat /root/.parcelas_letsencrypt_email)"
fi

cat > "$ENV_FILE" <<EOF
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"
JWT_SECRET="$JWT_SECRET"
JWT_EXPIRES_IN="7d"
PORT=$API_PORT
WEB_ORIGIN="https://$SSLIP_HOST"
VAPID_PUBLIC_KEY="$VAPID_PUBLIC_KEY"
VAPID_PRIVATE_KEY="$VAPID_PRIVATE_KEY"
VAPID_SUBJECT="mailto:${LETSENCRYPT_EMAIL:-no-reply@example.com}"
RP_ID="$SSLIP_HOST"
RP_NAME="Ferramentas do Mauro"
RP_ORIGIN="https://$SSLIP_HOST"
EOF
if [ -n "${BRAPI_TOKEN:-}" ]; then
  echo "BRAPI_TOKEN=\"$BRAPI_TOKEN\"" >> "$ENV_FILE"
fi
chown "$APP_USER":"$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# O frontend chama a API por caminho relativo (/api/v1); o Nginx faz o proxy internamente,
# então não precisamos do IP/domínio embutido no build e evitamos problemas de CORS.
echo 'VITE_API_URL=/api/v1' > "$APP_DIR/apps/web/.env"
chown "$APP_USER":"$APP_USER" "$APP_DIR/apps/web/.env"

log "7/9 — Instalando dependências, gerando client do Prisma, rodando migrations, build e seed"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && pnpm install --no-frozen-lockfile"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR/apps/api' && pnpm prisma:generate && pnpm prisma:deploy"

SEED_MARKER="$APP_DIR/.seeded"
if [ ! -f "$SEED_MARKER" ]; then
  sudo -u "$APP_USER" bash -c "cd '$APP_DIR/apps/api' && pnpm prisma:seed" && touch "$SEED_MARKER"
fi

sudo -u "$APP_USER" bash -c "cd '$APP_DIR/apps/api' && pnpm build"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR/apps/web' && pnpm build"

log "8/9 — Configurando serviço systemd do backend"
cat > /etc/systemd/system/parcelas-api.service <<EOF
[Unit]
Description=Parcelas API (NestJS)
After=network.target postgresql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR/apps/api
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node dist/main.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now parcelas-api
systemctl restart parcelas-api

log "9/9 — Configurando Nginx com HTTPS (Let's Encrypt em $SSLIP_HOST) e firewall"
mkdir -p "$ACME_WEBROOT"

# Passo 1: config HTTP-only (serve o desafio do Let's Encrypt em /.well-known/acme-challenge/).
# Precisa existir e estar no ar ANTES de pedir o certificado, senão o certbot não consegue validar
# que este servidor realmente responde por $SSLIP_HOST.
cat > /etc/nginx/sites-available/parcelas <<EOF
server {
    listen 80;
    server_name $SSLIP_HOST;

    location /.well-known/acme-challenge/ {
        root $ACME_WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
ln -sf /etc/nginx/sites-available/parcelas /etc/nginx/sites-enabled/parcelas
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

# Se uma execução anterior do certbot foi interrompida no meio (SSH caiu, reexecução em paralelo
# etc), o lock file fica órfão e todo certbot novo recusa rodar com "Another instance of Certbot
# is already running" mesmo sem nenhum processo de verdade ativo. Só limpa esse lock quando
# confirma que não há certbot rodando de verdade — nunca interrompe uma execução em andamento.
if ! pgrep -f "certbot" >/dev/null 2>&1; then
  rm -f /var/lib/letsencrypt/.certbot.lock /var/log/letsencrypt/.certbot.lock /etc/letsencrypt/.certbot.lock 2>/dev/null || true
fi

# Passo 2: emite (ou renova) o certificado. --deploy-hook fica salvo no arquivo de renovação do
# certbot e roda automaticamente também nas renovações futuras feitas pelo timer do systemd
# (certbot.timer, instalado junto com o pacote), então o Nginx recarrega sozinho com o certificado
# novo sem precisar rodar este script de novo.
CERTBOT_EMAIL_ARGS=(--register-unsafely-without-email)
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  CERTBOT_EMAIL_ARGS=(-m "$LETSENCRYPT_EMAIL")
fi
certbot certonly --webroot -w "$ACME_WEBROOT" -d "$SSLIP_HOST" \
  --non-interactive --agree-tos "${CERTBOT_EMAIL_ARGS[@]}" \
  --deploy-hook "systemctl reload nginx"
# Garante que a renovação automática (twice-daily) está ativa, independente do pacote já vir com
# ela habilitada por padrão ou não.
systemctl enable --now certbot.timer 2>/dev/null || true

# Passo 3: config final — HTTPS de verdade, com o desafio do ACME sempre acessível por HTTP puro
# (necessário para as renovações automáticas, que também usam o desafio HTTP-01).
cat > /etc/nginx/sites-available/parcelas <<EOF
server {
    listen 80;
    server_name $SSLIP_HOST;

    location /.well-known/acme-challenge/ {
        root $ACME_WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $SSLIP_HOST;

    ssl_certificate     /etc/letsencrypt/live/$SSLIP_HOST/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$SSLIP_HOST/privkey.pem;

    root $APP_DIR/apps/web/dist;
    index index.html;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:$API_PORT/api/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
nginx -t
systemctl reload nginx

echo
echo "======================================================================"
echo " Instalação concluída!"
echo "======================================================================"
echo " Acesse:        https://$SSLIP_HOST"
echo " Login demo:    mauroo.galvaoo@gmail.com / demo1234"
echo
echo " HTTPS:              Let's Encrypt em $SSLIP_HOST (renova sozinho via certbot.timer)"
echo " Backend (systemd): systemctl status parcelas-api"
echo " Logs do backend:   journalctl -u parcelas-api -f"
echo " Config Nginx:       /etc/nginx/sites-available/parcelas"
echo " .env do backend:    $ENV_FILE (permissões 600, contém segredos)"
if [ -n "${BRAPI_TOKEN:-}" ]; then
  echo " Token BRAPI:        configurado"
else
  echo " Token BRAPI:        não configurado (rate limit de cotações mais baixo)"
  echo "                     rode de novo com: BRAPI_TOKEN=sua_chave bash -c \"\$(curl -fsSL <url>)\""
fi
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then
  echo " E-mail Let's Encrypt: configurado (avisos de expiração do certificado)"
else
  echo " E-mail Let's Encrypt: não configurado (sem avisos por e-mail; a renovação automática funciona igual)"
  echo "                     rode de novo com: LETSENCRYPT_EMAIL=seu-email bash -c \"\$(curl -fsSL <url>)\""
fi
echo
echo " Para atualizar após um novo push no repositório, rode este mesmo"
echo " script novamente: ele é seguro para reexecutar."
echo "======================================================================"
