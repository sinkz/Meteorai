# Quanta

Rastreador de custo e produtividade para assistentes de IA de programação — local, privado, sem API externa, sem servidor.

> Atualmente compatível com **Claude Code**. Suporte a GitHub Copilot e Codex está no roadmap.

## Como os dados são coletados

O Quanta se integra ao sistema de hooks nativo do Claude Code para coletar metadados de sessão de forma passiva e automática. Nenhum passo manual é necessário após a instalação.

| Hook | O que captura |
|---|---|
| `SessionStart` | ID da sessão, branch git, caminho do projeto |
| `PreToolUse` | Nome da ferramenta, caminho do arquivo (antes da execução) |
| `PostToolUse` | Status do resultado da ferramenta, caminho do arquivo (após execução) |
| `Stop` | Duração da sessão, uso de tokens do transcript, custo em USD, score de assertividade |
| `Notification` | Eventos de nível de sessão |

**O que é armazenado:** nomes de ferramentas, caminhos de arquivos, timestamps, contagem de tokens (input/output/cache), custo em USD, score de assertividade, motivo de encerramento, nome do branch, nome do projeto.

**O que nunca é armazenado:** conteúdo de mensagens, diffs, texto de prompts, outputs de comandos ou qualquer dado conversacional.

Todos os dados ficam em `~/.quanta/tracker.db` (SQLite, apenas na sua máquina).

## Como visualizar as métricas

```bash
# Resumo agregado
quanta summary --period sprint     # sprint atual (padrão)
quanta summary --period day        # últimas 24 horas
quanta summary --period week       # últimos 7 dias
quanta summary --period month      # últimos 30 dias
quanta summary --period all        # histórico completo

# Lista de sessões com filtros
quanta sessions --branch feat/ISSUE-123
quanta sessions --from 2026-04-01
quanta sessions --min-score 70
quanta sessions --from 2026-04-01 --min-score 70 --limit 20

# Exportar dados brutos
quanta export --period month --format csv > abril.csv
quanta export --format json > tudo.json
quanta export --branch feat/ISSUE-123 --format json
```

Períodos: `day | week | month | sprint | all`. Sprint padrão = 14 dias (configurável).

## Instalação

```bash
git clone https://github.com/sinkz/meteorai ~/.claude/plugins/quanta
cd ~/.claude/plugins/quanta
npm install

# Opcional: disponibilizar o CLI fora das sessões Claude Code
npm link
quanta --version
```

O plugin ativa automaticamente os hooks `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop` e `Notification` na próxima sessão.

## Configuração

Crie `~/.quanta/config.json` para personalizar:

```json
{
  "ticket_pattern": "([A-Z]+-\\d+)",
  "sprint_start_day": "Monday",
  "sprint_duration_days": 14,
  "rerun_threshold_same_file": 3
}
```

Sobrescreva o diretório de dados com a variável de ambiente `QUANTA_HOME`:

```bash
QUANTA_HOME=/caminho/custom quanta summary
```

## Preços

Tabela de preços em `data/pricing.json` (USD por 1M tokens). Edite se a Anthropic atualizar os valores oficiais; modelos desconhecidos usam o preço do Sonnet como fallback.

## Privacidade

- Nenhum dado sai da sua máquina.
- Os hooks registram apenas metadados: nome da ferramenta, caminho do arquivo, contagens, timestamps. Conteúdo de mensagens e diffs nunca são persistidos.
- O parser de transcript descarta tudo exceto os campos `usage` e `model`.

## Limitações do MVP (v1.0)

- **Sem conversão para BRL** — evita dependência de API de câmbio.
- **Sem detecção de loop em tempo real** — apenas contagem de rerun de arquivos ao final da sessão.
- **Abort manual do usuário é indistinguível do sucesso** (o Claude Code não expõe `reason=user` em hooks hoje).
- **Sem integração com ClickUp/Linear/Slack**.
- **Multi-usuário**: cada dev tem seu próprio `tracker.db`; sem banco compartilhado.

## Desenvolvimento

```bash
npm test                  # testes unitários (node:test)
npm run test:acceptance   # cenários Gherkin de aceitação
npm run test:all          # todos os testes
```

Leia o `CLAUDE.md` antes de contribuir — o projeto usa TDD obrigatório, Gherkin para testes de aceitação e prefere fixtures reais a mocks.

## Licença

MIT
