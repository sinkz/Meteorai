# language: pt
Funcionalidade: Resumo de custos por período
  Como Tech Lead
  Quero ver o custo total e o número de sessões de um período
  Para justificar o ROI do Claude Code (US-01, US-03)

  Cenário: Período com sessões registradas
    Dado um banco limpo do cc-tracker
    E uma sessão "s1" no branch "feat/A-1" com custo 0.50 e score 80 há 1 horas
    E uma sessão "s2" no branch "feat/A-1" com custo 1.20 e score 75 há 2 horas
    E uma sessão "s3" no branch "feat/B-2" com custo 0.10 e score 40 há 36 horas
    Quando eu executo "summary --period day"
    Então a saída contém "Sessões:          2"
    E a saída contém "Custo total:      $1.70"
    E a saída contém "Score médio:      78"
    E a saída contém "feat/A-1"

  Cenário: Período sem sessões
    Dado um banco limpo do cc-tracker
    Quando eu executo "summary --period week"
    Então a saída contém "Sessões:          0"
    E a saída contém "Custo total:      $0.00"
