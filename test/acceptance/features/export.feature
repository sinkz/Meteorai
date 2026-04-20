Feature: Export sessions to JSON and CSV
  As a Tech Lead
  I want to export raw data for external analysis
  So I can integrate with dashboards and spreadsheets (US-03)

  Scenario: Export as JSON
    Given a clean quanta database
    And a session "exp12345" on branch "feat/E" with cost 0.99 and score 90 from 1 hours ago
    When I run "export --format json --period all"
    Then the output is a JSON array with 1 elements
    And the JSON contains an item with "id" equal to "exp12345"
    And the JSON contains an item with "cost_usd" equal to 0.99

  Scenario: Export as CSV
    Given a clean quanta database
    And a session "csv12345" on branch "feat/C" with cost 0.50 and score 77 from 1 hours ago
    When I run "export --format csv --period all"
    Then the output contains "id,started_at"
    And the output contains "csv12345"
