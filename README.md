# cc-tracker

Plugin para Claude Code que registra custo (tokens, USD) e produtividade
(score de assertividade, tool calls, reruns) por sessão — tudo local, sem
API externa, sem servidor.

## Instalação

```bash
git clone https://github.com/sinkz/meteorai ~/.claude/plugins/cc-tracker
cd ~/.claude/plugins/cc-tracker
npm install

# Opcional: disponibilizar o CLI fora das sessões Claude Code
npm link
cc-tracker --version
```

O plugin ativa automaticamente os hooks `SessionStart`, `PreToolUse`,
`PostToolUse`, `Stop` e `Notification` na próxima sessão.

Dados ficam em `~/.cc-tracker/tracker.db`.

## Uso

```bash
cc-tracker summary --period sprint
cc-tracker sessions --branch feat/FABLEE-123
cc-tracker sessions --from 2026-04-01 --min-score 70
cc-tracker export --period month --format csv > mes.csv
cc-tracker export --format json > tudo.json
```

Períodos: `day | week | month | sprint | all`. Sprint default = 14 dias
(configurável).

## Configuração opcional

Crie `~/.cc-tracker/config.json`:

```json
{
  "ticket_pattern": "([A-Z]+-\\d+)",
  "sprint_start_day": "Monday",
  "sprint_duration_days": 14,
  "rerun_threshold_same_file": 3
}
```

## Preços

Tabela em `data/pricing.json` (USD por 1M tokens). Edite se a Anthropic
ajustar os valores oficiais; modelos desconhecidos caem em Sonnet como
fallback.

## Privacidade

- Nenhum dado sai da máquina.
- Hooks registram apenas metadados: tool name, file path, contagens,
  timestamps. Conteúdo de mensagens e diffs nunca é persistido.
- O parser de transcript descarta tudo exceto `usage` e `model`.

## Limitações do MVP (v1.0)

Estas limitações são intencionais para manter o escopo pequeno. Estão no
roadmap para v1.1+:

- **Sem conversão BRL** — evita dependência de API de câmbio.
- **Sem detecção de loop em tempo real** — só rerun de arquivo via contagem
  no Stop.
- **Abort manual do usuário não é distinguível** do sucesso (o Claude Code
  não expõe `reason=user` em hooks hoje).
- **Sem integração com ClickUp/Linear/Slack**.
- **Multi-usuário**: cada dev tem seu próprio `tracker.db`; não há banco
  compartilhado.

## Desenvolvimento

```bash
npm test                  # unit tests (node:test)
npm run test:acceptance   # cenários Gherkin (pt-BR)
npm run test:all          # tudo
```

Leia `CLAUDE.md` antes de contribuir — projeto usa TDD obrigatório, Gherkin
para testes de aceitação, e evita mocks em favor de fixtures reais.

## Licença

MIT
