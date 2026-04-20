Feature: List and filter sessions
  As a Dev
  I want to see session history by project/branch
  So I can evaluate if my sessions were assertive (US-02)

  Scenario: Filter sessions by branch
    Given a clean quanta database
    And a session "abc123xx" on branch "feat/X" with cost 0.30 and score 55 from 1 hours ago
    And a session "def456yy" on branch "feat/Y" with cost 0.40 and score 70 from 1 hours ago
    When I run "sessions --branch feat/X"
    Then the output contains "abc123xx"
    And the output does not contain "def456yy"

  Scenario: Filter by minimum score
    Given a clean quanta database
    And a session "low12345" on branch "feat/Z" with cost 0.10 and score 40 from 1 hours ago
    And a session "high1234" on branch "feat/Z" with cost 0.20 and score 80 from 1 hours ago
    When I run "sessions --min-score 70"
    Then the output contains "high1234"
    And the output does not contain "low12345"
