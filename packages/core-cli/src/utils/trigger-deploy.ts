import { note, log } from "@clack/prompts";
import { executeCommandInteractive } from "./docker-interactive.js";
import { getDockerCompatibleEnvVars } from "./env-docker.js";
import path from "path";
import { createTriggerConfigJson } from "./database-init.js";

export async function deployTriggerTasks(rootDir: string): Promise<void> {
  const webappDir = path.join(rootDir, "apps", "webapp");
  const databaseDir = path.join(rootDir, "packages", "database");
  const typesDir = path.join(rootDir, "packages", "types");

  note(
    "We'll now deploy the trigger tasks to your Trigger.dev instance.",
    "🚀 Deploying Trigger.dev tasks"
  );

  try {
    // Login to trigger.dev CLI
    await executeCommandInteractive(
      "npx -y trigger.dev@4.0.0-v4-beta.22 login -a http://localhost:8030",
      {
        cwd: rootDir,
        message: "Logging in to Trigger.dev CLI...",
        showOutput: true,
      }
    );

    await executeCommandInteractive("pnpm install", {
      cwd: rootDir,
      message: "Running package installation",
      showOutput: true,
    });

    const envVars = await getDockerCompatibleEnvVars(rootDir);

    await executeCommandInteractive("pnpm build", {
      cwd: databaseDir,
      message: "Building @core/database...",
      showOutput: true,
      env: {
        DATABASE_URL: envVars.DATABASE_URL as string,
      },
    });

    await executeCommandInteractive("pnpm build", {
      cwd: typesDir,
      message: "Building @core/types...",
      showOutput: true,
    });

    // Deploy trigger tasks
    await executeCommandInteractive("pnpm run trigger:deploy", {
      cwd: webappDir,
      message: "Deploying Trigger.dev tasks...",
      showOutput: true,
      env: envVars,
    });

    log.success("Trigger.dev tasks deployed successfully!");
  } catch (error: any) {
    log.warning("Failed to deploy Trigger.dev tasks:");
    note(
      `${error.message}\n\nYou can deploy them manually later with:\n1. npx trigger.dev@v4-beta login -a http://localhost:8030\n2. pnpm trigger:deploy`,
      "Manual Deployment"
    );
  }
}
