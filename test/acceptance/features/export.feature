# language: pt
Funcionalidade: Exportar sessões para JSON e CSV
  Como Tech Lead
  Quero exportar dados brutos para análise externa
  Para integrar com dashboards e planilhas (US-03)

  Cenário: Exportar em JSON
    Dado um banco limpo do cc-tracker
    E uma sessão "exp12345" no branch "feat/E" com custo 0.99 e score 90 há 1 horas
    Quando eu executo "export --format json --period all"
    Então a saída é um JSON array com 1 elementos
    E o JSON contém um item com "id" igual a "exp12345"
    E o JSON contém um item com "cost_usd" igual a 0.99

  Cenário: Exportar em CSV
    Dado um banco limpo do cc-tracker
    E uma sessão "csv12345" no branch "feat/C" com custo 0.50 e score 77 há 1 horas
    Quando eu executo "export --format csv --period all"
    Então a saída contém "id,started_at"
    E a saída contém "csv12345"
