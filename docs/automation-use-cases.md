# Automation Workflow Use Cases

## Persona-Based Automation Workflows

This document outlines high-impact automation workflows for different personas using our supported integrations: Slack, Github, Google Drive, Linear, Calendar, Claude Code, and Gmail.

| Rule Name | Description | Persona | Integrations | Importance |
|-----------|-------------|---------|-------------|------------|
| **Code Review Prioritizer** | Automatically prioritize and assign code reviews based on PR size, dependencies, and team availability | Developer | Github, Slack, Calendar | 9.7 |
| **PR to Deployment Tracker** | Track PRs from submission to deployment, notifying stakeholders at each stage with estimated completion times | Developer | Github, Slack, Linear | 9.5 |
| **Standup Automator** | Collect daily updates from commit messages and Linear tasks, post summaries to team Slack channel before standups | Developer | Github, Linear, Slack | 9.3 |
| **Technical Debt Tracker** | Auto-identify technical debt from code comments and Linear tickets, creating weekly summaries with prioritization suggestions | Developer | Github, Linear, Slack | 9.2 |
| **Code Documentation Generator** | Use Claude Code to auto-generate documentation from code changes, adding to Google Drive knowledge base | Developer | Github, Claude Code, Google Drive | 9.1 |
| **Sprint Planning Assistant** | Collect Linear backlog items, analyze GitHub PRs, and create pre-populated sprint planning documents | Product Manager | Linear, Github, Google Drive | 9.8 |
| **Feature Impact Dashboard** | Track feature usage metrics from analytics, connect to Linear tickets, and generate impact reports | Product Manager | Linear, Gmail, Google Drive | 9.6 |
| **Customer Feedback Connector** | Route customer feedback from Gmail to appropriate Linear tickets and notify product team in Slack | Product Manager | Gmail, Linear, Slack | 9.5 |
| **Release Notes Automator** | Generate release notes from Linear tickets and GitHub PRs, distribute via Slack and email | Product Manager | Linear, Github, Slack, Gmail | 9.4 |
| **Meeting Effectiveness Tracker** | Monitor calendar events, auto-document action items in Linear, and track follow-through | Product Manager | Calendar, Linear, Slack | 9.2 |
| **Investor Update Compiler** | Aggregate key metrics from various sources into monthly investor update templates | Founder | Google Drive, Linear, Gmail | 9.9 |
| **Competitive Intelligence Monitor** | Monitor competitor activities from various sources, creating summaries with Claude Code | Founder | Gmail, Claude Code, Google Drive | 9.7 |
| **Strategic Alignment Tracker** | Connect company OKRs to actual work items in Linear, creating executive dashboards | Founder | Linear, Google Drive, Slack | 9.6 |
| **Board Meeting Automator** | Collect data for board meetings, pre-populate slides, and send reminders with preparation materials | Founder | Calendar, Google Drive, Gmail | 9.5 |
| **Team Pulse Monitor** | Analyze communication patterns and work distribution to identify burnout risks | Founder | Slack, Github, Linear | 9.3 |
| **Deal Stage Progression** | Move deals through pipeline stages based on email interactions and scheduled meetings | Sales | Gmail, Calendar, Slack | 9.8 |
| **Proposal Generator** | Auto-generate customized proposals using templates and client-specific data | Sales | Google Drive, Gmail, Claude Code | 9.7 |
| **Meeting Follow-up Orchestrator** | Schedule and personalize follow-ups based on meeting notes and conversation topics | Sales | Calendar, Gmail, Slack | 9.6 |
| **Competitive Deal Intelligence** | Alert sales team when competitors are mentioned in prospect communications | Sales | Gmail, Slack, Claude Code | 9.4 |
| **Customer Success Handoff** | Automate post-sale transition with documentation, training materials, and onboarding schedules | Sales | Gmail, Google Drive, Calendar | 9.3 |