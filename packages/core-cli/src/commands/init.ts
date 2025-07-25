import { intro, outro, text, confirm, spinner, note, log } from "@clack/prompts";
import { fileExists, updateEnvFile } from "../utils/file.js";
import { checkPostgresHealth } from "../utils/docker.js";
import { executeCommandInteractive } from "../utils/docker-interactive.js";
import { printCoreBrainLogo } from "../utils/ascii.js";
import { setupEnvFile } from "../utils/env.js";
import { hasTriggerConfig } from "../utils/env-checker.js";
import { handleDockerLogin } from "../utils/docker-login.js";
import { deployTriggerTasks } from "../utils/trigger-deploy.js";
import path from "path";
import * as fs from "fs";
import { createTriggerConfigJson, initTriggerDatabase } from "../utils/database-init.js";
import { parse } from "dotenv";
import { expand } from "dotenv-expand";

export async function initCommand() {
  // Display the CORE brain logo
  printCoreBrainLogo();

  intro("🚀 Core Development Environment Setup");

  // Step 1: Confirm this is the Core repository
  note(
    "Please ensure you have:\n• Docker and Docker Compose installed\n• Git installed\n• pnpm package manager installed\n• You are in the Core repository directory",
    "📋 Prerequisites"
  );

  // Check if package.json name has "core" in it, else exit
  const pkgPath = path.join(process.cwd(), "package.json");
  let isCoreRepo = false;
  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (typeof pkg.name === "string" && pkg.name.includes("core")) {
        isCoreRepo = true;
      }
    }
  } catch (err) {
    // ignore, will prompt below
  }

  if (!isCoreRepo) {
    note(
      "Please clone the Core repository first:\n\ngit clone https://github.com/redplanethq/core.git\ncd core\n\nThen run 'core init' again.",
      "📥 Clone Repository"
    );
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
      outro("❌ Setup failed: " + error.message);
      process.exit(1);
    }

    // Step 3: Docker compose up -d in root
    try {
      await executeCommandInteractive("docker compose up -d", {
        cwd: rootDir,
        message: "Starting Docker containers in root...",
        showOutput: true,
      });
    } catch (error: any) {
      outro("❌ Setup failed: " + error.message);
      process.exit(1);
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
      outro("❌ Please check your Docker setup and try again");
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
      outro("❌ Setup failed: " + error.message);
      process.exit(1);
    }

    // Step 6: Docker compose up for trigger
    try {
      await executeCommandInteractive("docker compose up -d", {
        cwd: triggerDir,
        message: "Starting Trigger.dev containers...",
        showOutput: true,
      });
    } catch (error: any) {
      outro("❌ Setup failed: " + error.message);
      process.exit(1);
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
      note("🎉 Docker containers are now running!");

      const { prodSecretKey, projectRefId, personalToken } = await initTriggerDatabase(triggerDir);

      await createTriggerConfigJson(personalToken as string);

      const openaiApiKey = await text({
        message: "Enter your OpenAI API Key:",
        validate: (value) => {
          if (!value || value.length === 0) {
            return "OpenAI API Key is required";
          }
          return;
        },
      });

      // Step 11: Update .env with project details
      const s6 = spinner();
      s6.start("Updating .env with Trigger.dev configuration...");

      try {
        await updateEnvFile(envPath, "TRIGGER_PROJECT_ID", projectRefId as string);
        await updateEnvFile(envPath, "TRIGGER_SECRET_KEY", prodSecretKey as string);
        await updateEnvFile(envPath, "OPENAI_API_KEY", openaiApiKey as string);
        s6.stop("✅ Updated .env with Trigger.dev configuration");
      } catch (error: any) {
        s6.stop("❌ Failed to update .env file");
        outro("❌ Setup failed: " + error.message);
        process.exit(1);
      }

      // Step 12: Restart root docker-compose with new configuration
      try {
        const file = fs.readFileSync(envPath);

        const parsed = parse(file);
        const envVarsExpand = expand({ parsed, processEnv: {} }).parsed || {};

        await executeCommandInteractive("docker compose up -d", {
          cwd: rootDir,
          message: "Starting Core services with new Trigger.dev configuration...",
          showOutput: true,
          env: envVarsExpand,
        });
      } catch (error: any) {
        outro("❌ Setup failed: " + error.message);
        process.exit(1);
      }
    }

    // Step 13: Handle Docker login
    note("Run the following command to login to Docker registry:", "🐳 Docker Registry Login");
    await handleDockerLogin(rootDir, triggerEnvPath);

    // Step 14: Deploy Trigger.dev tasks
    await deployTriggerTasks(rootDir);

    // Step 15: Final instructions
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
    outro("🎉 Setup Complete!");
    process.exit(0);
  } catch (error: any) {
    outro(`❌ Setup failed: ${error.message}`);
    process.exit(1);
  }
}
