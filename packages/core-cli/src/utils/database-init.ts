/* eslint-disable @typescript-eslint/no-explicit-any */
import Knex, { Knex as KnexT } from "knex";
import { v4 as uuidv4 } from "uuid";
import nodeCrypto from "node:crypto";
import { parse } from "dotenv";
import { expand } from "dotenv-expand";
import path from "node:path";
import { log } from "@clack/prompts";
import { customAlphabet } from "nanoid";

import $xdgAppPaths from "xdg-app-paths";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

export const xdgAppPaths = $xdgAppPaths as unknown as typeof $xdgAppPaths.default;

const tokenGenerator = customAlphabet("123456789abcdefghijkmnopqrstuvwxyz", 40);

// Generate tokens internally
let ENCRYPTION_KEY: string;
const COMMON_ID = "9ea0412ea8ef441ca03c7952d011ab56";
const key = tokenGenerator(20);

export async function createOrg(knex: KnexT) {
  try {
    log.step("Checking for existing CORE user and organization...");
    const existingUser = await knex("User").where({ id: COMMON_ID }).first();

    if (existingUser) {
      log.info("CORE user and organization already exist. Skipping creation.");
      return COMMON_ID; // User already exists, return the ID
    }

    log.step("Creating CORE user, organization, and org member...");
    // Create new entries using a transaction
    await knex.transaction(async (trx) => {
      // Create User
      await trx("User").insert({
        id: COMMON_ID,
        admin: true,
        authenticationMethod: "MAGIC_LINK",
        displayName: "CORE",
        email: "core@heysol.ai",
        name: "CORE",
        confirmedBasicDetails: true,
        updatedAt: new Date(),
      });

      // Create Organization
      await trx("Organization").insert({
        id: COMMON_ID,
        slug: "CORE",
        title: "CORE",
        v3Enabled: true,
        updatedAt: new Date(),
      });

      // Create OrgMember
      await trx("OrgMember").insert({
        id: COMMON_ID,
        organizationId: COMMON_ID,
        userId: COMMON_ID,
        role: "ADMIN",
        updatedAt: new Date(),
      });
    });

    log.success("CORE user, organization, and org member created.");
    return COMMON_ID;
  } catch (error) {
    log.error(`Error creating org: ${error}`);
    throw new Error(`Error creating org: ${error}`);
  }
}

export async function createPersonalToken(knex: KnexT) {
  const id = uuidv4().replace(/-/g, "");

  log.step("Checking for existing personal access token for CLI user...");
  const existingToken = await knex("PersonalAccessToken")
    .where({ userId: COMMON_ID, name: "cli" })
    .first();

  if (existingToken) {
    log.info("Personal access token for CLI already exists. Skipping creation.");
    return;
  }

  log.step("Creating CLI personal access token...");
  // Generate a new token similar to the original: "tr_pat_" + 40 lowercase alphanumeric chars

  const personalToken = `tr_pat_${tokenGenerator(40)}`;

  await knex("PersonalAccessToken").insert({
    id,
    name: "cli",
    userId: COMMON_ID,
    updatedAt: new Date(),
    obfuscatedToken: obfuscateToken(personalToken),
    hashedToken: hashToken(personalToken),
    encryptedToken: encryptToken(personalToken),
  });
  log.success("CLI personal access token created.");

  return personalToken;
}

function obfuscateToken(token: string) {
  const withoutPrefix = token.replace("tr_pat_", "");
  const obfuscated = `${withoutPrefix.slice(0, 4)}${"•".repeat(18)}${withoutPrefix.slice(-4)}`;
  return `tr_pat_${obfuscated}`;
}

export async function createProject(knex: KnexT) {
  try {
    log.step("Checking if CORE project already exists for the organization...");
    const existingProject = await knex("Project")
      .where({ name: "CORE", organizationId: COMMON_ID })
      .first();

    if (existingProject) {
      log.info(
        "CORE project already exists. Skipping creation of project and runtime environments."
      );
      // Fetch the prod runtime environment for this project
      const prodRuntimeEnv = await knex("RuntimeEnvironment")
        .where({
          projectId: existingProject.id,
          slug: "prod",
        })
        .first();

      let prodSecret;
      if (prodRuntimeEnv && prodRuntimeEnv.apiKey) {
        prodSecret = prodRuntimeEnv.apiKey;
      } else {
        // fallback to old behavior if not found (should not happen)
        prodSecret = `tr_prod_${key}`;
      }

      return {
        projectId: existingProject.id,
        prodSecret,
        projectRef: existingProject.externalRef || "proj_core",
      };
    }

    const id = uuidv4().replace(/-/g, "");

    log.step("Creating CORE project and runtime environments...");
    await knex.transaction(async (trx) => {
      await knex("Project")
        .insert({
          id,
          name: "CORE",
          organizationId: COMMON_ID,
          slug: "CORE",
          externalRef: `proj_core`,
          version: "V3",
          updatedAt: new Date(),
        })
        .transacting(trx);

      await knex("RuntimeEnvironment")
        .insert(
          ["dev", "stg", "prod"].map((env: string) => ({
            id: uuidv4(),
            slug: env,
            apiKey: `tr_${env}_${key}`,
            organizationId: COMMON_ID,
            orgMemberId: COMMON_ID,
            projectId: id,
            type: env === "prod" ? "PRODUCTION" : env === "stg" ? "STAGING" : "DEVELOPMENT",
            pkApiKey: `tr_pk_${env}${key}`,
            shortcode: env,
            updatedAt: new Date(),
          }))
        )
        .transacting(trx);
    });

    log.success("CORE project and runtime environments created.");
    return { projectId: id, prodSecret: `tr_prod_${key}`, projectRef: `proj_core` };
  } catch (error) {
    log.error(`Error creating project: ${error}`);
    throw new Error(`Error creating project: ${error}`);
  }
}

function encryptToken(value: string) {
  const nonce = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, nonce);

  let encrypted = cipher.update(value, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag().toString("hex");

  return {
    nonce: nonce.toString("hex"),
    ciphertext: encrypted,
    tag,
  };
}

export function hashToken(token: string): string {
  const hash = nodeCrypto.createHash("sha256");
  hash.update(token);
  return hash.digest("hex");
}

// Main initialization function
export async function initTriggerDatabase(triggerDir: string) {
  log.step("Waiting for Trigger.dev to be ready on http://localhost:8030/login...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Check if Trigger.dev is up and /login returns 200 before proceeding
  const MAX_RETRIES = 30;
  const RETRY_DELAY_MS = 2000;
  let loginOk = false;
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch("http://localhost:8030/login");
      if (res.status === 200) {
        loginOk = true;
        log.step("Trigger.dev is up and /login returned 200.");
        break;
      }
    } catch (e) {
      // ignore, will retry
    }

    if (i < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  if (!loginOk) {
    log.error("Trigger.dev did not respond with 200 on /login after waiting.");
    throw new Error("Trigger.dev is not ready at http://localhost:8030/login");
  }

  const envPath = path.join(triggerDir, ".env");
  log.step(`Loading environment variables from ${envPath}...`);
  const file = readFileSync(envPath);

  const parsed = parse(file);
  const envVarsExpand = expand({ parsed, processEnv: {} }).parsed || {};

  // Set the encryption key from the .env file
  ENCRYPTION_KEY = envVarsExpand.ENCRYPTION_KEY as string;
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY not found in trigger/.env file");
  }

  const knex = Knex({
    client: "pg", // Use PostgreSQL as the database client
    connection: envVarsExpand.DIRECT_URL?.replace("host.docker.internal", "localhost"), // Database connection URL from environment variable
  });

  try {
    log.step("Initializing Trigger.dev database...");

    // Create organization and user
    await createOrg(knex);

    // Create personal access token
    const personalToken = await createPersonalToken(knex);

    // Create project and return details
    const projectDetails = await createProject(knex);

    log.success("Trigger.dev database initialized successfully.");

    log.step("Setting things up...");
    await new Promise((resolve) => setTimeout(resolve, 5000));

    return {
      prodSecretKey: projectDetails.prodSecret,
      projectRefId: projectDetails.projectRef,
      personalToken,
    };
  } catch (error) {
    log.error(`Initialization failed: ${error}`);
    throw new Error(`Initialization failed: ${error}`);
  }
}

function getGlobalConfigFolderPath() {
  const configDir = xdgAppPaths("trigger").config();

  return configDir;
}

const CONFIG_FILE = "config.json";

function getAuthConfigFilePath() {
  return path.join(getGlobalConfigFolderPath(), CONFIG_FILE);
}

/**
 * Creates the Trigger.dev CLI config.json file in ~/Library/Preferences/trigger/config.json
 * with the given personal access token. If the config already exists, it will be deleted first.
 *
 * @param {string} personalToken - The personal access token to store in the config.
 */
export async function createTriggerConfigJson(personalToken: string) {
  const configPath = getAuthConfigFilePath();

  // If config.json exists, delete it
  mkdirSync(path.dirname(configPath), {
    recursive: true,
  });

  const config = {
    version: 2,
    currentProfile: "default",
    profiles: {
      default: {
        accessToken: personalToken,
        apiUrl: "http://localhost:8030",
      },
    },
  };

  writeFileSync(path.join(configPath), JSON.stringify(config, undefined, 2), {
    encoding: "utf-8",
  });
}
