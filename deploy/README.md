# Deploy em uma VPS (Ubuntu/Debian)

Instala e coloca o app inteiro no ar (frontend + backend + PostgreSQL) numa VPS limpa,
usando Nginx como servidor web e systemd para manter o backend rodando.

## Uso

Conecte via SSH na VPS como `root` e rode:

```bash
curl -fsSL https://raw.githubusercontent.com/atcomrebrand/test/claude/credit-card-installments-system-8o6tq0/deploy/setup-vps.sh | bash
```

Ao final, o script imprime a URL de acesso (`http://SEU_IP`) e o login de demonstração.

### Token da BRAPI (opcional, recomendado)

O módulo de investimentos busca cotações de ações/FIIs na [brapi.dev](https://brapi.dev). Sem
token, funciona, mas com um rate limit bem apertado — um portfólio com vários ativos pode ver
"alguns" preços faltando quando várias cotações são buscadas de uma vez. Cadastro grátis em
brapi.dev gera um token que aumenta bastante esse limite. Para configurar (na primeira instalação
ou numa reexecução), passe-o assim — nunca fica hardcoded no script nem no repositório, só
persistido localmente na própria VPS (`/root/.parcelas_brapi_token`, permissão 600):

```bash
BRAPI_TOKEN=sua_chave_aqui bash -c "$(curl -fsSL https://raw.githubusercontent.com/atcomrebrand/test/claude/credit-card-installments-system-8o6tq0/deploy/setup-vps.sh)"
```

Reexecuções seguintes (mesmo sem passar `BRAPI_TOKEN` de novo) continuam usando o token já salvo.

## O que o script instala

- Node.js 20 LTS + pnpm
- PostgreSQL (banco e usuário criados automaticamente, senha aleatória)
- Backend NestJS rodando como serviço systemd (`parcelas-api`), reinicia sozinho se cair
- Nginx servindo o frontend (build estático) e fazendo proxy de `/api/v1` para o backend
- Firewall (`ufw`) liberando apenas SSH, HTTP e HTTPS

## Atualizar depois de um novo push

Rode o mesmo comando de novo — o script é idempotente: puxa o código mais recente,
reinstala dependências se necessário, roda migrations pendentes e reinicia o serviço.

## Comandos úteis pós-instalação

```bash
systemctl status parcelas-api      # status do backend
journalctl -u parcelas-api -f      # logs do backend em tempo real
systemctl restart parcelas-api     # reiniciar o backend manualmente
nginx -t && systemctl reload nginx # validar e recarregar config do Nginx
cat /root/.parcelas_db_password    # senha gerada do banco (se precisar)
```

## Domínio próprio + HTTPS (opcional)

Se você apontar um domínio para o IP da VPS, pode ativar HTTPS gratuito com:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d seu-dominio.com
```

O Certbot ajusta o `server_name` e a config de SSL automaticamente no arquivo
`/etc/nginx/sites-available/parcelas`.
