# Quanta v2

Rastreador de custo e produtividade para o Claude Code — local, privado, zero configuração, nativo em OpenTelemetry.

> Os dados nunca saem da sua máquina. Sem API externa, sem servidor, sem nuvem.

## Como funciona

```
Claude Code (binário nativo)
  └─ exportador OTel ──POST /v1/metrics──► quanta receiver (127.0.0.1:4318)
                                                   │
                                                   ▼
                                         ~/.quanta/tracker.db
                                                   │
                               ┌───────────────────┴──────────────────┐
                               ▼                                       ▼
                          quanta CLI                            quanta serve
                  (summary / sessions / export)          (dashboard web :7681)
```

### As três partes

| Parte | Como inicia | Porta |
|-------|-------------|-------|
| **Hooks do plugin** (`SessionStart`, `SessionEnd`) | Automático — o Claude Code dispara sozinho | — |
| **Receiver OTLP** | Sobe automaticamente no `SessionStart`; ou manualmente | `127.0.0.1:4318` |
| **Dashboard web** | Manual — rode `quanta serve` quando quiser ver | `127.0.0.1:7681` |

O plugin e o receiver funcionam **automaticamente em background**. Você não precisa fazer nada.  
O dashboard web é **opcional** — suba quando quiser uma visualização gráfica das métricas.

---

## Início rápido

```bash
# 1. Clone como plugin do Claude Code
git clone https://github.com/sinkz/meteorai ~/.claude/plugins/quanta
cd ~/.claude/plugins/quanta
npm install

# 2. (Opcional) disponibilizar o CLI globalmente
npm link

# 3. Inicie uma sessão Claude Code — hooks ativam automaticamente
claude

# 4. Veja as métricas no terminal
quanta summary --period sprint

# 5. Ou abra o dashboard web
quanta serve          # → http://127.0.0.1:7681
quanta serve --open   # já abre o browser
quanta serve --port 8080  # porta personalizada
```

---

## Referência do CLI

### `quanta summary`

```bash
quanta summary                    # sprint atual (14 dias por padrão)
quanta summary --period day       # últimas 24 horas
quanta summary --period week      # últimos 7 dias
quanta summary --period month     # últimos 30 dias
quanta summary --period all       # histórico completo
```

### `quanta sessions`

```bash
quanta sessions                          # últimas 50 sessões
quanta sessions --branch feat/ISSUE-42   # filtrar por branch
quanta sessions --project meu-app        # filtrar por projeto
quanta sessions --from 2026-04-01        # a partir de uma data (YYYY-MM-DD)
quanta sessions --limit 20
```

### `quanta export`

```bash
quanta export --format json              # JSON (padrão)
quanta export --format csv               # CSV
quanta export --period month > abril.csv
quanta export --branch feat/ISSUE-42 --format json
```

### `quanta receiver` (avançado)

O receiver é iniciado automaticamente pelo hook `SessionStart`. Você também pode gerenciá-lo manualmente:

```bash
quanta receiver start    # iniciar em primeiro plano
quanta receiver stop     # parar o receiver em background
quanta receiver status   # exibir pid e porta
```

### `quanta serve`

```bash
quanta serve             # inicia o dashboard em http://127.0.0.1:7681
quanta serve --port 8080 # porta personalizada
quanta serve --open      # abre o browser automaticamente
```

Encerre com `Ctrl-C`. O servidor escuta apenas em `127.0.0.1` — nunca exposto na rede.

---

## O que é coletado

| Coletado | Nunca coletado |
|----------|---------------|
| ID da sessão, início/fim, motivo de encerramento | Conteúdo de mensagens ou texto de prompts |
| Nome do branch git, caminho do projeto, diretório de trabalho | Diffs ou conteúdo de arquivos |
| Contagem de tokens (input / output / cache read) | Outputs de comandos |
| Custo em USD (via OTel do Claude Code) | Qualquer dado conversacional |
| Contagem de commits, linhas de código alteradas | |

Todos os dados ficam em `~/.quanta/tracker.db` (SQLite, apenas na sua máquina).

---

## Configuração

Crie `~/.quanta/config.json` para personalizar:

```json
{
  "ticket_pattern": "([A-Z]+-\\d+)",
  "sprint_duration_days": 14
}
```

Sobrescreva o diretório de dados com a variável de ambiente `QUANTA_HOME`:

```bash
QUANTA_HOME=/caminho/custom quanta summary
```

---

## Privacidade

- Nenhum dado sai da sua máquina.
- Os hooks capturam apenas metadados (nomes de ferramentas, caminhos de arquivos, timestamps, contagem de tokens). Conteúdo de mensagens e diffs nunca são persistidos.
- O receiver escuta apenas em `127.0.0.1` — inacessível pela rede.
- O dashboard web também escuta apenas em `127.0.0.1`.

---

## Desenvolvimento

```bash
npm test                  # testes unitários (node:test)
npm run test:acceptance   # cenários Gherkin de aceitação
npm run test:all          # todos os testes
```

Leia o `CLAUDE.md` antes de contribuir — TDD obrigatório, fixtures reais em vez de mocks, código em inglês.

## Licença

MIT
