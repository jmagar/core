import { intro, outro, text, confirm, spinner, note, log } from "@clack/prompts";
import { fileExists, updateEnvFile } from "../utils/file.js";
import { checkPostgresHealth } from "../utils/docker.js";
import { executeDockerCommandInteractive } from "../utils/docker-interactive.js";
import { printCoreBrainLogo } from "../utils/ascii.js";
import { setupEnvFile } from "../utils/env.js";
import { hasTriggerConfig } from "../utils/env-checker.js";
import path from "path";

export async function initCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();

  intro("🚀 Core Development Environment Setup");

  // Step 1: Confirm this is the Core repository
  note("Please ensure you have:\n• Docker and Docker Compose installed\n• Git installed\n• pnpm package manager installed\n• You are in the Core repository directory", "📋 Prerequisites");
  
  const isCoreRepo = await confirm({
    message: "Are you currently in the Core repository directory?",
  });

  if (!isCoreRepo) {
    note("Please clone the Core repository first:\n\ngit clone https://github.com/redplanethq/core.git\ncd core\n\nThen run 'core init' again.", "📥 Clone Repository");
    outro("❌ Setup cancelled. Please navigate to the Core repository first.");
    process.exit(1);
  }

  const rootDir = process.cwd();
  const triggerDir = path.join(rootDir, "trigger");

  try {
    // Step 2: Setup .env file in root
    const s1 = spinner();
    s1.start("Setting up .env file in root folder...");

    const envPath = path.join(rootDir, ".env");
    const envExists = await fileExists(envPath);

    try {
      await setupEnvFile(rootDir, "root");
      if (envExists) {
        s1.stop("✅ .env file already exists in root");
      } else {
        s1.stop("✅ Copied .env.example to .env");
      }
    } catch (error: any) {
      s1.stop(error.message);
      process.exit(1);
    }

    // Step 3: Docker compose up -d in root
    try {
      await executeDockerCommandInteractive("docker compose up -d", {
        cwd: rootDir,
        message: "Starting Docker containers in root...",
        showOutput: true,
      });
    } catch (error: any) {
      throw error;
    }

    // Step 4: Check if postgres is running
    const s3 = spinner();
    s3.start("Checking PostgreSQL connection...");

    let retries = 0;
    const maxRetries = 30;

    while (retries < maxRetries) {
      if (await checkPostgresHealth()) {
        s3.stop("PostgreSQL is running on localhost:5432");
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      retries++;
    }

    if (retries >= maxRetries) {
      s3.stop("L PostgreSQL not accessible on localhost:5432");
      outro("Please check your Docker setup and try again");
      process.exit(1);
    }

    // Step 5: Setup .env file in trigger
    const s4 = spinner();
    s4.start("Setting up .env file in trigger folder...");

    const triggerEnvPath = path.join(triggerDir, ".env");
    const triggerEnvExists = await fileExists(triggerEnvPath);

    try {
      await setupEnvFile(triggerDir, "trigger");
      if (triggerEnvExists) {
        s4.stop("✅ .env file already exists in trigger");
      } else {
        s4.stop("✅ Copied trigger .env.example to trigger/.env");
      }
    } catch (error: any) {
      s4.stop(error.message);
      process.exit(1);
    }

    // Step 6: Docker compose up for trigger
    try {
      await executeDockerCommandInteractive("docker compose up -d", {
        cwd: triggerDir,
        message: "Starting Trigger.dev containers...",
        showOutput: true,
      });
    } catch (error: any) {
      throw error;
    }

    // Step 7: Check if Trigger.dev configuration already exists
    const triggerConfigExists = await hasTriggerConfig(envPath);

    if (triggerConfigExists) {
      note(
        "✅ Trigger.dev configuration already exists in .env file\n   Skipping Trigger.dev setup steps...",
        "Configuration Found"
      );
    } else {
      // Step 8: Show login instructions
      outro("🎉 Docker containers are now running!");
      note(
        "1. Open http://localhost:8030 in your browser\n2. Login to Trigger.dev (check container logs with: docker logs trigger-webapp --tail 50)",
        "Next Steps"
      );

      const loginConfirmed = await confirm({
        message: "Have you logged in to Trigger.dev successfully?",
      });

      if (!loginConfirmed) {
        outro("❌ Setup cancelled. Please login to Trigger.dev first and run the command again.");
        process.exit(1);
      }

      // Step 9: Get project details
      note(
        "1. Create a new organization and project\n2. Go to project settings\n3. Copy the Project ID and Secret Key",
        "In Trigger.dev (http://localhost:8030)"
      );

      const projectCreated = await confirm({
        message: "Have you created an organization and project in Trigger.dev?",
      });

      if (!projectCreated) {
        outro(
          "❌ Setup cancelled. Please create an organization and project first and run the command again."
        );
        process.exit(1);
      }

      // Step 10: Get project ID and secret
      const projectId = await text({
        message: "Enter your Trigger.dev Project ID:",
        validate: (value) => {
          if (!value || value.length === 0) {
            return "Project ID is required";
          }
          return;
        },
      });

      const secretKey = await text({
        message: "Enter your Trigger.dev Secret Key for production:",
        validate: (value) => {
          if (!value || value.length === 0) {
            return "Secret Key is required";
          }
          return;
        },
      });

      // Step 11: Update .env with project details
      const s6 = spinner();
      s6.start("Updating .env with Trigger.dev configuration...");

      try {
        await updateEnvFile(envPath, "TRIGGER_PROJECT_ID", projectId as string);
        await updateEnvFile(envPath, "TRIGGER_SECRET_KEY", secretKey as string);
        s6.stop("✅ Updated .env with Trigger.dev configuration");
      } catch (error: any) {
        s6.stop("❌ Failed to update .env file");
        throw error;
      }

      // Step 12: Restart root docker-compose with new configuration
      try {
        await executeDockerCommandInteractive("docker compose down", {
          cwd: rootDir,
          message: "Stopping Core services...",
          showOutput: true,
        });

        await executeDockerCommandInteractive("docker compose up -d", {
          cwd: rootDir,
          message: "Starting Core services with new Trigger.dev configuration...",
          showOutput: true,
        });
      } catch (error: any) {
        throw error;
      }
    }

    // Step 13: Show docker login instructions
    note("Run the following command to login to Docker registry:", "🐳 Docker Registry Login");

    try {
      // Read env file to get docker registry details
      const envContent = await import("fs").then((fs) =>
        fs.promises.readFile(triggerEnvPath, "utf8")
      );
      const envLines = envContent.split("\n");

      const getEnvValue = (key: string) => {
        const line = envLines.find((l) => l.startsWith(`${key}=`));
        return line ? line.split("=")[1] : "";
      };

      const dockerRegistryUrl = getEnvValue("DOCKER_REGISTRY_URL");
      const dockerRegistryUsername = getEnvValue("DOCKER_REGISTRY_USERNAME");
      const dockerRegistryPassword = getEnvValue("DOCKER_REGISTRY_PASSWORD");

      log.info(
        `docker login ${dockerRegistryUrl} -u ${dockerRegistryUsername} -p ${dockerRegistryPassword}`
      );
    } catch (error) {
      log.info("docker login <REGISTRY_URL> -u <USERNAME> -p <PASSWORD>");
    }

    const dockerLoginConfirmed = await confirm({
      message: "Have you completed the Docker login successfully?",
    });

    if (!dockerLoginConfirmed) {
      outro("❌ Setup cancelled. Please complete Docker login first and run the command again.");
      process.exit(1);
    }

    // Step 14: Deploy Trigger.dev tasks
    note(
      "We'll now deploy the trigger tasks to your Trigger.dev instance.",
      "🚀 Deploying Trigger.dev tasks"
    );

    try {
      // Login to trigger.dev CLI
      await executeDockerCommandInteractive(
        "npx -y trigger.dev@v4-beta login -a http://localhost:8030",
        {
          cwd: rootDir,
          message: "Logging in to Trigger.dev CLI...",
          showOutput: true,
        }
      );

      // Deploy trigger tasks
      await executeDockerCommandInteractive("pnpm trigger:deploy", {
        cwd: rootDir,
        message: "Deploying Trigger.dev tasks...",
        showOutput: true,
      });

      log.success("Trigger.dev tasks deployed successfully!");
    } catch (error: any) {
      log.warning("Failed to deploy Trigger.dev tasks:");
      note(
        `${error.message}\n\nYou can deploy them manually later with:\n1. npx trigger.dev@v4-beta login -a http://localhost:8030\n2. pnpm trigger:deploy`,
        "Manual Deployment"
      );
    }

    // Step 15: Final instructions
    outro("🎉 Setup Complete!");
    note(
      [
        "Your services are now running:",
        "",
        "• Core Application: http://localhost:3033",
        "• Trigger.dev: http://localhost:8030",
        "• PostgreSQL: localhost:5432",
        "",
        "You can now start developing with Core!",
        "",
        "ℹ️  When logging in to the Core Application, you can find the login URL in the Docker container logs:",
        "    docker logs core-app --tail 50",
      ].join("\n"),
      "🚀 Services Running"
    );
  } catch (error: any) {
    outro(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
