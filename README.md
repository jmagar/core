<div align="center">
  <a href="https://core.heysol.ai">
    <img src="https://github.com/user-attachments/assets/89066cdd-204b-46c2-8ad4-4935f5ca9edd" width="200px" alt="CORE logo" />
  </a>
</div>



## C.O.R.E.

**Contextual Observation & Recall Engine**

C.O.R.E is a shareable memory for LLMs which is private, portable and 100% owned by the user. You can either run it locally or use our hosted version and then connect with other tools like Cursor, Claude to share your context at multiple places.

C.O.R.E is built for two reasons:

1. To give you complete ownership of your memory, stored locally and accessible across any app needing LLM context.
2. To help SOL (your AI assistant) access your context, facts, and preferences for more relevant and personalized responses.

## Demo Video
https://www.youtube.com/embed/CvR5kIGsqns


## How is C.O.R.E different from other Memory Providers?

Unlike most memory systems—which act like basic sticky notes, only showing what’s true right now. C.O.R.E is built as a dynamic, living temporal knowledge graph:

- Every fact is a first-class “Statement” with full history, not just a static edge between entities.
- Each statement includes what was said, who said it, when it happened, and why it matters.
- You get full transparency: you can always trace the source, see what changed, and explore why the system “believes” something.

### Use Case Example: Real Change Auditing

Imagine you ask SOL: "What changed in our pricing since Q1?"

With C.O.R.E, you see exactly what prices changed, who approved them, the context (meeting, email, document), and when each update happened—enabling true compliance, auditability, and insight across products, teams, and time.

Or ask: “What does Mike know about Project Phoenix?” and get a timeline of meetings, decisions, and facts Mike was involved in, with full traceability to those specific events.


## C.O.R.E Cloud Setup

1. Sign up to [Core Cloud](https://core.heysol.ai) and start building your memory graph.
2. Add your text that you want to save in memory. Once clicking on add button your memory graph will be generated.
3. [Connect Core Memory MCP with Cursor](#connecting-core-mcp-with-cursor)

## C.O.R.E Local Setup

#### Prerequisites

1. Docker
2. OpenAI API Key

#### Run C.O.R.E locally

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

## Connecting CORE MCP with Cursor

1. Open the CORE dashboard and navigate to the API section to generate a new API token.
2. In Cursor, go to: Settings → Tools & Integrations → New MCP Server.
3. Add the CORE MCP server using the configuration format below. Be sure to replace the API_TOKEN value with the token you generated in step 1.

    MCP configuration to add in Cursor
    
    ``` json
    {
      "mcpServers": {
        "memory": {
          "command": "npx",
          "args": ["-y", "@redplanethq/core-mcp"],
          "env": {
            "API_TOKEN": "YOUR_API_TOKEN_HERE",
            "API_BASE_URL": "https://core.heysol.ai",
            "SOURCE": "cursor"
          }
        }
      }
    }
    ```
4. Go to Settings-> User rules -> New Rule -> and add the below rule to ensure all your chat interactions are being stored in CORE memory

```
After every interaction, update the memory with the user's query and the assistant's
response to core-memory mcp. sessionId should be the uuid of the conversation
```
   
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
