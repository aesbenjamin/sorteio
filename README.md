# Sorteador de Brindes

Aplicação de sorteio de brindes com frontend estático (GitHub Pages) e backend no Supabase (free tier).

## Como funciona

- Participantes acessam `index.html` e clicam em **Tentar a sorte**
- A probabilidade de ganhar é calculada adaptativamente: aumenta conforme o tempo passa e os brindes não são distribuídos, garantindo que todos sejam sorteados até o fim do período
- Quando alguém ganha, preenche nome e contato para registro — o brinde é entregue fisicamente por um responsável
- A página `admin.html` permite configurar o evento e acompanhar os ganhadores em tempo real

---

## Setup — passo a passo

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **New project**, defina nome, senha do banco e região
3. Aguarde o provisionamento (~2 min)

### 2. Criar as tabelas e funções

No painel do Supabase, vá em **SQL Editor** e execute os arquivos na ordem:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_atomic_claim_function.sql
```

Cole o conteúdo de cada arquivo e clique em **Run**.

### 3. Criar usuário admin

No painel do Supabase, vá em **Authentication → Users → Invite user** (ou **Add user**) e crie um usuário com e-mail e senha. Esse usuário não é usado diretamente no app — a autenticação do admin usa a **Service Role Key**.

### 4. Deploy das Edge Functions

Instale o [Supabase CLI](https://supabase.com/docs/guides/cli) e faça login:

```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_ID
npx supabase functions deploy draw
npx supabase functions deploy register-winner
```

> O `SEU_PROJECT_ID` está na URL do painel: `https://supabase.com/dashboard/project/SEU_PROJECT_ID`

### 5. Configurar as chaves no frontend

Edite o arquivo `js/config.js` com as credenciais do seu projeto:

```javascript
const SUPABASE_URL      = "https://SEU_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "SUA_ANON_KEY_AQUI";
```

Ambas as chaves estão em **Settings → API**:
- **Project URL** → `SUPABASE_URL`
- **Project API keys → anon public** → `SUPABASE_ANON_KEY`

> A **Service Role Key** (secret) **não** vai para o código do frontend. Ela é usada apenas na tela de login do admin, sendo armazenada temporariamente no `sessionStorage` do navegador do administrador.

### 6. Deploy no GitHub Pages

```bash
git init
git add .
git commit -m "feat: sorteador de brindes"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

No repositório do GitHub:
1. Vá em **Settings → Pages**
2. Em **Source**, selecione **Deploy from a branch**
3. Branch: `main` / Folder: `/ (root)`
4. Clique em **Save**

Após alguns segundos, o site estará disponível em `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/`.

---

## Usando o admin

1. Acesse `https://SEU_USUARIO.github.io/SEU_REPOSITORIO/admin.html`
2. Insira a **Service Role Key** do Supabase (Settings → API → service_role)
3. Configure o evento: nome, quantidade de brindes e período
4. Clique em **Salvar configuração**

O sorteio começa automaticamente no horário configurado.

---

## Estrutura de arquivos

```
/
├── index.html                          # Página de sorteio
├── admin.html                          # Página administrativa
├── css/style.css                       # Estilos compartilhados
├── js/
│   ├── config.js                       # ⚠️ Preencher com suas chaves
│   ├── raffle.js                       # Lógica do sorteio
│   └── admin.js                        # Lógica do admin
└── supabase/
    ├── config.toml
    ├── migrations/
    │   ├── 001_initial_schema.sql      # Tabelas + RLS
    │   └── 002_atomic_claim_function.sql # Função atômica
    └── functions/
        ├── draw/index.ts               # Edge Function: sorteio
        └── register-winner/index.ts    # Edge Function: registro
```

---

## Algoritmo de distribuição

A probabilidade de ganhar em cada acesso é:

```
P = prizes_remaining / max(prizes_remaining, estimated_remaining_accesses)
```

Onde `estimated_remaining_accesses` é calculado pela taxa de acessos dos últimos 30 minutos projetada para o tempo restante. Isso garante:

- No início do evento com muita demanda: P baixa (brindes se distribuem gradualmente)
- Conforme o tempo passa e brindes restam: P sobe automaticamente
- Nos minutos finais: P tende a 1 para garantir que todos os brindes sejam distribuídos
