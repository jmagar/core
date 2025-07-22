import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

/**
 * Reads environment variables from .env file and replaces localhost URLs with host.docker.internal
 * for Docker container compatibility
 */
export async function getDockerCompatibleEnvVars(rootDir: string): Promise<Record<string, string>> {
  const envPath = path.join(rootDir, ".env");

  try {
    // Use dotenv to parse and expand variables

    const envVarsExpand =
      dotenvExpand.expand(dotenv.config({ path: envPath, processEnv: {} })).parsed || {};

    const getEnvValue = (key: string): string => {
      return envVarsExpand[key] || "";
    };

    const replaceLocalhostWithDockerHost = (value: string): string => {
      return value
        .replace(/localhost/g, "host.docker.internal")
        .replace(/127\.0\.0\.1/g, "host.docker.internal");
    };

    // Get all required environment variables
    const envVars = {
      ANTHROPIC_API_KEY: getEnvValue("ANTHROPIC_API_KEY"),
      API_BASE_URL: replaceLocalhostWithDockerHost(getEnvValue("API_BASE_URL")),
      DATABASE_URL: replaceLocalhostWithDockerHost(getEnvValue("DATABASE_URL")),
      EMBEDDING_MODEL: getEnvValue("EMBEDDING_MODEL"),
      ENCRYPTION_KEY: getEnvValue("ENCRYPTION_KEY"),
      MODEL: getEnvValue("MODEL") || "gpt-4.1-2025-04-14",
      NEO4J_PASSWORD: getEnvValue("NEO4J_PASSWORD"),
      NEO4J_URI: replaceLocalhostWithDockerHost(getEnvValue("NEO4J_URI")),
      NEO4J_USERNAME: getEnvValue("NEO4J_USERNAME"),
      OPENAI_API_KEY: getEnvValue("OPENAI_API_KEY"),
      TRIGGER_PROJECT_ID: getEnvValue("TRIGGER_PROJECT_ID"),
    };

    return envVars;
  } catch (error) {
    throw new Error(`Failed to read .env file: ${error}`);
  }
}
