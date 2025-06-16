<div align="center">
  <a href="https://core.heysol.ai">
    <img src="https://github.com/user-attachments/assets/3ae051f7-e77b-42b3-91d2-af69888e4d3f" width="200px" alt="CORE logo" />
  </a>
</div>

## C.O.R.E.

**Contextual Observation & Recall Engine**

C.O.R.E lets you create a private, portable, open-source memory space for LLMs, all stored locally for full data control. You decide what to share or connect with other tools, managing exactly what gets recalled and where.

C.O.R.E is built for two reasons:

1. To give you complete ownership of your memory, stored locally and accessible across any app needing LLM context.
2. To help SOL (your AI assistant) access your context, facts, and preferences for more relevant and personalized responses.

## How is C.O.R.E different from other Memory Providers?

C.O.R.E uses a **temporal knowledge graph**, not basic vector or key-value memory. This enables structured recall—capturing not just what was said, but who said it, when, and why it mattered.

You can ask, “_What changed in our pricing since Q1?_” and see precise updates, people involved, and the timeline. Or, “_What does Mike know about Project Phoenix?_” and get answers based on meetings or discussions she joined.

C.O.R.E supports **temporal reasoning**, **relational memory**, and **traceability** —ideal for AI assistants needing structured, historical, and inferential memory.

## Getting Started

### Prerequisites

1. Docker
2. OpenAI API Key

### Run C.O.R.E locally by

1. **Copy Environment Variables**

   Copy the example environment file to `.env`:

   ```bash
   cp .env.example .env
   ```

2. **Start the Application**

   Use Docker Compose to start all required services:

   ```bash
   docker-compose up
   ```

3. **Access the App**

   Once the containers are running, open your browser and go to [http://localhost:3000](http://localhost:3000).

4. **Login with Magic Link**

   - Choose the "Magic Link" login option.
   - Enter your email.
   - Copy the magic link from terminal logs and open it in your browser.

5. **Create Your Private Space & Ingest Data**

   - In the dashboard, go to the ingest section.
   - Type a message, e.g., `I love playing badminton`, and click "Add".
   - Your memory is queued for processing; you can monitor its status in the server logs.
   - Once processing is complete, nodes will be added to your private knowledge graph and visible in the dashboard.
   - You can later choose to connect this memory to other tools or keep it private.

6. **Search Your Memory**

   - Use the dashboard's search feature to query your ingested data within your private space.

## Connecting to the API

You can also interact with C.O.R.E. programmatically via its APIs.

1. **Generate an API Key**

   - In the dashboard, navigate to the API section and generate a new API key.

2. **API Endpoints**

   - Use your API key to authenticate requests to the following endpoints:

     - **Ingest API:** `POST /ingest`
     - **Search API:** `POST /search`

   - See below for example request bodies and details.

### Ingest API

- **Endpoint:** `/ingest`
- **Method:** `POST`
- **Authentication:** Bearer token (API key)
- **Body Example:**

  ```json
  {
    "episodeBody": "I love playing badminton",
    "referenceTime": "2024-06-01T12:00:00Z",
    "source": "user", //  Which tool or user is ingesting
    "spaceId": "your-space-id", // optional, for multiple spaces
    "sessionId": "your-session-id" // optional
  }
  ```

- **Behavior:**
  - Each ingestion is queued per user for processing in their private space.
  - The system automatically creates and links graph nodes.
  - You can monitor the status in the logs or dashboard.
  - You can later connect this memory to other tools as you wish.

### Search API

- **Endpoint:** `/search`
- **Method:** `POST`
- **Authentication:** Bearer token (API key)
- **Body Example:**

  ```json
  {
    "query": "badminton",
    "spaceId": "your-space-id", // optional
    "sessionId": "your-session-id" // optional
  }
  ```

- **Behavior:**
  - Returns relevant text matches scoped to your private memory space.

> For detailed API schemas, see [`apps/webapp/app/routes/ingest.tsx`](apps/webapp/app/routes/ingest.tsx) and [`apps/webapp/app/routes/search.tsx`](apps/webapp/app/routes/search.tsx).

---

## Features (v1)

### Feature Checklist

#### ✅ Done

- [x] Private memory space: You can ingest and search your own data.
- [x] Ingest for workspace: You can ingest data into a workspace.
- [x] Search for workspace: You can search within a workspace.

#### 🛠️ In Progress / Planned

- [ ] Multiple Spaces with unique URLs
- [ ] User-controlled sharing and privacy
- [ ] Ingestion filters rules
- [ ] Granular API Key Permissions
- [ ] Improved Session and Space Support
- [ ] Audit Logging & API Key Management
- [ ] Role-Based Access Control
- [ ] Webhooks & Notifications

## Usage Guidelines

**Store:**

- Conversation history
- User preferences
- Task context
- Reference materials

**Don't Store:**

- Sensitive data (PII)
- Credentials
- System logs
- Temporary data
