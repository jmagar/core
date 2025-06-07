<div align="center">
  <a href="https://mysigma.ai">
    <img src="https://github.com/user-attachments/assets/3ae051f7-e77b-42b3-91d2-af69888e4d3f" width="200px" alt="CORE logo" />
  </a>
</div>

# CORE

Simple memory management system for AI agents with per-space ingestion and search capabilities.

## Core APIs

### 1. Ingest API

- Endpoint per space for data ingestion
- Queue-based processing per user
- Creates and links graph nodes automatically
- Optional review queue for controlled ingestion

### 2. Search API

- Simple text-based search
- Input: query string
- Output: relevant text matches
- Scoped to specific memory space

## Features (v1)

- [ ] Auto-mode default with optional queue review
- [ ] Multiple Spaces support (unique URL per space)
- [ ] Basic rules engine for ingestion filters
- [ ] Clear, user-friendly guidelines
- [ ] Simple text search

## Usage Guidelines

Store:

- Conversation history
- User preferences
- Task context
- Reference materials

Don't Store:

- Sensitive data (PII)
- Credentials
- System logs
- Temporary data
