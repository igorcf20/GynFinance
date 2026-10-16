# Instalar o Gynfinance num servidor próprio

O sistema roda numa VPS com Docker: um banco Postgres, o servidor do Gynfinance (que também
entrega o site) e o Caddy, que cuida do HTTPS com certificado gratuito.

## Do que precisa

- Uma VPS Linux (Ubuntu 24.04, por exemplo) com 2 GB de memória e 20 GB de disco.
  Hospedagem com data center no Brasil deixa o sistema mais rápido para os clientes.
- Um domínio ou subdomínio para o sistema, como `app.gynfinance.com.br`.

## 1. Apontar o domínio

No painel do domínio, crie um registro **A** com o nome do subdomínio (`app`) apontando para o
IP da VPS. Pode levar alguns minutos para valer.

## 2. Preparar a VPS

```bash
# Docker oficial
curl -fsSL https://get.docker.com | sh

# Firewall: só SSH e web
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

## 3. Baixar e configurar

```bash
git clone https://github.com/igorcf20/GynFinance.git /opt/gynfinance
cd /opt/gynfinance
cp .env.example .env
# Gere duas senhas e cole no .env, junto com o domínio:
openssl rand -hex 24   # DB_ADMIN_PASSWORD
openssl rand -hex 24   # APP_DB_PASSWORD
nano .env
```

## 4. Subir

```bash
docker compose up -d --build
docker compose ps        # banco, app e https "running"; migrar "exited (0)"
```

Abra `https://app.gynfinance.com.br`. A demonstração aparece primeiro; "Usar com o meu negócio"
leva para criar a conta e fazer a configuração inicial.

## Atualizar para uma versão nova

```bash
cd /opt/gynfinance
git pull
docker compose up -d --build   # roda as migrações novas antes de subir o servidor
```

## Backup do banco

Uma cópia por dia, guardando as últimas 14:

```bash
mkdir -p /opt/backups
cat > /etc/cron.daily/gynfinance-backup <<'SCRIPT'
#!/bin/sh
cd /opt/gynfinance
docker compose exec -T banco pg_dump -U gynfinance_admin -Fc gynfinance > /opt/backups/gynfinance-$(date +%F).dump
ls -1t /opt/backups/gynfinance-*.dump | tail -n +15 | xargs -r rm
SCRIPT
chmod +x /etc/cron.daily/gynfinance-backup
```

Copie a pasta `/opt/backups` para fora da VPS de tempos em tempos (outro servidor ou um
armazenamento na nuvem). Backup que só existe na mesma máquina se perde junto com ela.

Para restaurar um backup:

```bash
docker compose exec -T banco pg_restore -U gynfinance_admin -d gynfinance --clean --if-exists < /opt/backups/gynfinance-AAAA-MM-DD.dump
```

## Como a segurança funciona

- Senhas guardadas com bcrypt; a sessão fica num cookie que o JavaScript da página não lê,
  só trafega por HTTPS e vale 30 dias.
- Tentativas de entrar e de criar conta são limitadas a 10 por minuto por endereço.
- O servidor sempre usa a empresa da sessão, nunca um id vindo do navegador. Além disso, o
  próprio banco (regras de RLS) só mostra a cada pessoa as empresas dela, e o servidor conecta
  com um usuário do banco sem permissão para ignorar essas regras.
- O banco não fica exposto na internet: só o Caddy (portas 80 e 443) recebe conexões.
