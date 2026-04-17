# language: pt
Funcionalidade: Listar e filtrar sessões
  Como Dev
  Quero ver histórico de sessões por projeto/branch
  Para avaliar se minhas sessões foram assertivas (US-02)

  Cenário: Filtrar sessões por branch
    Dado um banco limpo do cc-tracker
    E uma sessão "abc123xx" no branch "feat/X" com custo 0.30 e score 55 há 1 horas
    E uma sessão "def456yy" no branch "feat/Y" com custo 0.40 e score 70 há 1 horas
    Quando eu executo "sessions --branch feat/X"
    Então a saída contém "abc123xx"
    E a saída não contém "def456yy"

  Cenário: Filtrar por score mínimo
    Dado um banco limpo do cc-tracker
    E uma sessão "low12345" no branch "feat/Z" com custo 0.10 e score 40 há 1 horas
    E uma sessão "high1234" no branch "feat/Z" com custo 0.20 e score 80 há 1 horas
    Quando eu executo "sessions --min-score 70"
    Então a saída contém "high1234"
    E a saída não contém "low12345"
