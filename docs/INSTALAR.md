# Instalar o Gynfinance num servidor próprio

O sistema roda numa VPS com Docker: um banco Postgres, o servidor do Gynfinance (que também
entrega o site) e o Caddy, que cuida do HTTPS com certificado gratuito.

É uma instalação só para todos os assinantes: cada negócio cria a própria conta no mesmo
endereço, e o banco mantém os dados de cada empresa separados. Não há uma instalação por cliente.

## Do que precisa

- Uma VPS Linux (Ubuntu 24.04, por exemplo) com 2 GB de memória e 20 GB de disco.
  Hospedagem com data center no Brasil deixa o sistema mais rápido para os clientes.
- Um domínio ou subdomínio para o sistema. O da KodeMI é `gynfinance.kodemi.pt`.

## 1. Apontar o domínio

No painel do domínio `kodemi.pt`, crie um registro **A** com o nome `gynfinance` apontando para o
IP da VPS. Pode levar alguns minutos para valer. Para conferir, `dig +short gynfinance.kodemi.pt`
deve responder o IP da VPS.

## Antes de tudo: a VPS já tem um site?

```bash
ss -ltnp | grep -E ':(80|443) '
```

- **Não aparece nada:** siga o caminho normal abaixo; o Caddy do Gynfinance cuida das portas 80 e 443
  e do certificado.
- **Aparece nginx, Apache, Caddy, Traefik ou um painel (Easypanel, Coolify, aaPanel...):** as portas
  já têm dono. Siga os passos 2 e 3 e depois vá para
  [Quando a VPS já tem um site](#quando-a-vps-já-tem-um-site) em vez do passo 4.

## 2. Preparar a VPS

```bash
# Docker oficial
curl -fsSL https://get.docker.com | sh

# Firewall: libera web sem fechar o SSH. Se o SSH não usa a porta 22, libere a porta dele antes.
ufw status                       # se já estiver "active", basta liberar 80 e 443
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

## 3. Baixar e configurar

```bash
git clone https://github.com/igorcf20/GynFinance.git /opt/gynfinance
# Enquanto o PR #1 não entrar na main, o sistema está no ramo do módulo inicial:
git -C /opt/gynfinance checkout feat/modulo-inicial
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

Abra `https://gynfinance.kodemi.pt`: aparece o site de venda (pasta `site/`). O sistema fica em
`https://gynfinance.kodemi.pt/app/`, onde a demonstração aparece primeiro; "Usar com o meu negócio"
leva para criar a conta e fazer a configuração inicial.

## Quando a VPS já tem um site

Suba só o banco e o servidor, sem o Caddy. O servidor fica ouvindo apenas dentro da VPS, em
`127.0.0.1:3000` (troque com `PORTA_APP` no `.env` se essa porta já estiver em uso):

```bash
docker compose up -d --build banco migrar app
curl -s http://127.0.0.1:3000/api/saude    # {"ok":true}
```

Depois aponte o site que já existe para ele. No **nginx**, um arquivo
`/etc/nginx/sites-available/gynfinance.kodemi.pt`:

```nginx
server {
    server_name gynfinance.kodemi.pt;
    client_max_body_size 10m;   # comprovantes de até 5 MB
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/gynfinance.kodemi.pt /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d gynfinance.kodemi.pt   # certificado HTTPS gratuito
```

O `Host` precisa chegar igual ao endereço do navegador: o servidor recusa gravações vindas de
outra origem. Num painel (Easypanel, Coolify...), crie um domínio `gynfinance.kodemi.pt` que
encaminha para `http://127.0.0.1:3000` com HTTPS ligado.

## Atualizar para uma versão nova

```bash
cd /opt/gynfinance
git pull
docker compose up -d --build   # roda as migrações novas antes de subir o servidor
```

Se a VPS já tinha um site (Gynfinance atrás do nginx ou de um painel), atualize sem o Caddy, senão
ele tenta ocupar as portas 80 e 443:

```bash
docker compose up -d --build banco migrar app
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
- O banco não fica exposto na internet: só o Caddy (portas 80 e 443) recebe conexões. O servidor
  só aceita conexões de dentro da VPS (127.0.0.1).
