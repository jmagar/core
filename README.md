<div align="center">
  <a href="https://core.heysol.ai">
    <img src="https://github.com/user-attachments/assets/3ae051f7-e77b-42b3-91d2-af69888e4d3f" width="200px" alt="CORE logo" />
  </a>
</div>

# C.O.R.E.

**Contextual Observation & Recall Engine**

C.O.R.E. is a private memory management system designed to give users full control over their data. It enables you to create a personal memory space, where you can ingest, organize, and search your information. You can selectively share or connect this memory with multiple tools, putting you in charge of what gets recalled and where.

## Getting Started

Follow these steps to run C.O.R.E. locally:

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
   - Enter your email address.
   - The magic link will be output in the terminal logs. Copy and paste it into your browser to complete login.

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
    "type": "Conversation", // or "Text"
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

- [ ] Multiple Spaces support (unique URL per space). A "space" lets you group and control memory for specific tools or contexts.
- [ ] User-controlled sharing: Add memory to multiple tools or keep it private within a space.
- [ ] Basic rules engine for ingestion filters.
- [ ] Granular API Key Permissions: Allow API keys to be scoped to specific spaces and actions (e.g., read, write, ingest, search), so users can control access per space and per operation.
- [ ] Improved Session and Space Support: Currently, you can pass `sessionId` in the ingest API to associate data with a conversation. We plan to enhance session-based CRUD operations, so you can manage, retrieve, and organize memory by session as well as by space, enabling true multi-tenancy and conversation context.
- [ ] Audit Logging & API Key Management: Add audit logs for API usage and allow users to view, revoke, and rotate API keys.
- [ ] Role-Based Access Control (RBAC): Enable roles (admin, member, viewer) per space for better team collaboration and security.
- [ ] Webhooks/Notifications: Allow users to receive real-time notifications or webhooks on ingestion, search, or other events.

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
