# Core CLI

🧠 **CORE - Contextual Observation & Recall Engine**

A Command-Line Interface for setting up and managing the Core development environment.

## Installation

```bash
npm install -g @redplanethq/core
```

## Commands

### `core init`

**One-time setup command** - Initializes the Core development environment with full configuration.

### `core start`

**Daily usage command** - Starts all Core services (Docker containers).

### `core stop`

**Daily usage command** - Stops all Core services (Docker containers).

## Getting Started

### Prerequisites

- **Node.js** (v18.20.0 or higher)
- **Docker** and **Docker Compose**
- **Git**
- **pnpm** package manager

### Initial Setup

1. **Run the initialization command:**

   ```bash
   core init
   ```

2. **The CLI will guide you through the complete setup process:**

#### Step 1: Repository Validation

- The CLI checks if you're in the Core repository
- If not, it offers to clone the repository for you
- Choose **Yes** to clone automatically, or **No** to clone manually

#### Step 2: Environment Configuration

- Copies `.env.example` to `.env` in the root directory
- Copies `trigger/.env.example` to `trigger/.env`
- Skips copying if `.env` files already exist

#### Step 3: Docker Services Startup

- Starts main Core services: `docker compose up -d`
- Starts Trigger.dev services: `docker compose up -d` (in trigger/ directory)
- Shows real-time output with progress indicators

#### Step 4: Database Health Check

- Verifies PostgreSQL is running on `localhost:5432`
- Retries for up to 60 seconds if needed

#### Step 5: Trigger.dev Setup (Interactive)

- **If Trigger.dev is not configured:**

  1. Prompts you to open http://localhost:8030
  2. Asks you to login to Trigger.dev
  3. Guides you to create an organization and project
  4. Collects your Project ID and Secret Key
  5. Updates `.env` with your Trigger.dev configuration
  6. Restarts Core services with new configuration

- **If Trigger.dev is already configured:**
  - Skips setup and shows "Configuration already exists" message

#### Step 6: Docker Registry Login

- Displays docker login command with credentials from `.env`
- Waits for you to complete the login process

#### Step 7: Trigger.dev Task Deployment

- Automatically runs: `npx trigger.dev@v4-beta login -a http://localhost:8030`
- Deploys tasks with: `pnpm trigger:deploy`
- Shows manual deployment instructions if automatic deployment fails

#### Step 8: Setup Complete!

- Confirms all services are running
- Shows service URLs and connection information

## Daily Usage

After initial setup, use these commands for daily development:

### Start Services

```bash
core start
```

Starts all Docker containers for Core development.

### Stop Services

```bash
core stop
```

Stops all Docker containers.

## Service URLs

After setup, these services will be available:

- **Core Application**: http://localhost:3033
- **Trigger.dev**: http://localhost:8030
- **PostgreSQL**: localhost:5432

## Troubleshooting

### Repository Not Found

If you run commands outside the Core repository:

- The CLI will offer to clone the repository automatically
- Choose **Yes** to clone in the current directory
- Or navigate to the Core repository manually

### Docker Issues

- Ensure Docker is running
- Check Docker Compose is installed
- Verify you have sufficient system resources

### Trigger.dev Setup Issues

- Check container logs: `docker logs trigger-webapp --tail 50`
- Ensure you can access http://localhost:8030
- Verify your network allows connections to localhost

### Environment Variables

The CLI automatically manages these environment variables:

- `TRIGGER_PROJECT_ID` - Your Trigger.dev project ID
- `TRIGGER_SECRET_KEY` - Your Trigger.dev secret key
- Docker registry credentials for deployment

### Manual Trigger.dev Deployment

If automatic deployment fails, run manually:

```bash
npx trigger.dev@v4-beta login -a http://localhost:8030
pnpm trigger:deploy
```

## Development Workflow

1. **First time setup:** `core init`
2. **Daily development:**
   - `core start` - Start your development environment
   - Do your development work
   - `core stop` - Stop services when done

## Support

For issues and questions:

- Check the main Core repository: https://github.com/redplanethq/core
- Review Docker container logs for troubleshooting
- Ensure all prerequisites are properly installed

## Features

- 🚀 **One-command setup** - Complete environment initialization
- 🔄 **Smart configuration** - Skips already configured components
- 📱 **Real-time feedback** - Live progress indicators and output
- 🐳 **Docker integration** - Full container lifecycle management
- 🔧 **Interactive setup** - Guided configuration process
- 🎯 **Error handling** - Graceful failure with recovery instructions

---

**Happy coding with Core!** 🎉
