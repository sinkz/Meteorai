Feature: Cost summary by period
  As a Tech Lead
  I want to see total cost and session count for a period
  So I can justify the ROI of Claude Code (US-01, US-03)

  Scenario: Period with recorded sessions
    Given a clean quanta database
    And a session "s1" on branch "feat/A-1" with cost 0.50 and score 80 from 1 hours ago
    And a session "s2" on branch "feat/A-1" with cost 1.20 and score 75 from 2 hours ago
    And a session "s3" on branch "feat/B-2" with cost 0.10 and score 40 from 36 hours ago
    When I run "summary --period day"
    Then the output contains "Sessions:         2"
    And the output contains "Total cost:       $1.70"
    And the output contains "Avg. score:       78"
    And the output contains "feat/A-1"

  Scenario: Period with no sessions
    Given a clean quanta database
    When I run "summary --period week"
    Then the output contains "Sessions:         0"
    And the output contains "Total cost:       $0.00"
