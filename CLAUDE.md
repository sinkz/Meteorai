# cc-tracker — Regras de Desenvolvimento

Este arquivo define como trabalhar neste repositório. Releia antes de abrir
qualquer PR. Estas regras têm precedência sobre hábitos padrão.

---

## 1. TDD é obrigatório

Ordem não-negociável para qualquer código de produção:

1. **Red** — escreva o teste antes do código. O teste deve falhar pelo motivo
   certo (funcionalidade ausente, não erro de sintaxe ou import).
2. **Green** — escreva o mínimo de código para passar.
3. **Refactor** — limpe com o teste verde. Sem mudar comportamento.

Regras práticas:

- Um teste novo por commit quando possível. Commits pequenos > commits
  grandes.
- Se uma PR adiciona código sem teste que o exercite, ela está incompleta.
- Bug fix começa por um **teste que reproduz o bug** (red). Só depois o fix.
- Não comente teste "quebrado". Conserte ou delete.
- Cobertura não é meta — **comportamento observável é**. Teste o contrato
  público, não a implementação interna.

Exceções permitidas (devem ser justificadas no PR):

- Scripts de build/scaffold descartáveis.
- Tipos/interfaces puras sem lógica.
- `README.md`, `CLAUDE.md` e configs estáticas.

## 2. Gherkin para testes de aceitação

Fluxos ponta-a-ponta (CLI, hooks disparando contra o SQLite real, cenários
de usuário do PRD §2.2) vão em `.feature` usando Gherkin.

- Diretório: `test/acceptance/*.feature` + runner em `test/acceptance/run.mjs`.
- Linguagem: **português** (mesma do PRD) — `# language: pt`.
- Um `Cenário` = um caminho observável do usuário. Nada de cenário "testa que
  a função X retorna Y" — isso é teste unitário.
- Steps reutilizáveis vivem em `test/acceptance/steps/`.
- Use `Esquema do Cenário` com `Exemplos` para variações de input.

Exemplo mínimo:

```gherkin
# language: pt
Funcionalidade: Resumo de custos por sprint
  Como Tech Lead
  Quero ver o custo total do sprint atual
  Para justificar o ROI do Claude Code

  Cenário: Sprint com sessões registradas
    Dado que existem 3 sessões no sprint atual totalizando $2.40
    Quando eu executo "cc-tracker summary --period sprint"
    Então a saída contém "Custo total: $2.40"
    E a saída contém "Sessões: 3"
```

Testes unitários continuam em `test/*.test.js` usando `node:test` — Gherkin
não substitui unit tests.

## 3. Evite mocks desnecessários

Mocks são um cheiro, não uma ferramenta padrão.

**Não mocke**:

- SQLite. Use um banco real em arquivo temporário (`tmpdir()`/UUID) e delete
  no `afterEach`. `better-sqlite3` em WAL é rápido suficiente para milhares
  de testes.
- `fs` — escreva/leia arquivos reais em `os.tmpdir()`.
- Git — inicialize um repo real de fixture (`git init` em tmpdir, commit
  dummy). É mais rápido e mais fiel que mockar `child_process`.
- Parser de transcript — use fixtures JSONL reais em
  `test/fixtures/transcripts/`.
- Clock — para tempo determinístico, **passe `now` como parâmetro** em vez de
  mockar `Date.now()`. Pure function > mock.

**Mocke apenas quando**:

- A dependência é de rede externa não controlada (não temos nenhuma no MVP).
- A operação é destrutiva fora do sandbox do teste (ex: enviar email).
- Reproduzir o cenário real é impossível (ex: falha de kernel).

Se precisar mockar, justifique em comentário de 1 linha acima do mock.

**Injeção de dependência simples**: prefira funções puras que recebem o que
precisam. Um `calculateCost(usage, pricing)` é sempre melhor que um
`calculateCost(usage)` que lê `pricing.json` internamente.

## 4. Código

- Node.js >= 18, ES modules (`"type": "module"` no `package.json`).
- JavaScript puro no MVP (sem TypeScript).
- Sem frameworks de teste externos — use `node:test` + `node:assert/strict`.
- Sem bibliotecas de mock (`sinon`, `jest.mock`, etc.). Se você acha que
  precisa, releia a seção 3.
- Lints básicos: sem variáveis não usadas, sem `console.log` em código de
  produção (use `process.stderr.write` em hooks se precisar diagnosticar).
- Hooks devem ser **idempotentes e tolerantes a falha**: nunca bloqueiem o
  Claude Code. Qualquer erro vai para `~/.cc-tracker/errors.log` e o hook
  sai com código 0.

## 5. Privacidade

- Hooks **nunca** persistem conteúdo de mensagens, diffs, outputs de
  comandos. Só metadados: tool name, file path, timestamps, contagens.
- `lib/transcript.js` descarta tudo que não seja `usage` e `model`. Teste
  explícito em `test/transcript.test.js` garante isso.
- `git.js` lê apenas `branch`, `HEAD`, `log -1 --format=%s`. Nunca lê diff.

## 6. Commits

- Mensagens convencionais: `feat:`, `fix:`, `test:`, `refactor:`, `docs:`,
  `chore:`.
- Um commit = uma mudança coesa. `test: add transcript parser fixtures`
  seguido de `feat: add transcript parser` é ideal.
- Commits de teste (red) antes do commit de implementação (green) quando
  prático — torna o histórico auditável.

## 7. Definition of Done

Uma feature só está pronta quando:

1. Testes unitários cobrem o comportamento novo.
2. Se é fluxo de usuário do PRD §2.2, tem cenário Gherkin passando.
3. `npm test` verde local.
4. Sem TODOs novos no código sem issue associada.
5. README atualizado se a mudança é visível ao usuário.
