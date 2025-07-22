/* eslint-disable @typescript-eslint/no-explicit-any */
import Knex, { Knex as KnexT } from "knex";
import { v4 as uuidv4 } from "uuid";
import nodeCrypto from "node:crypto";
import dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";
import path from "node:path";
import { log } from "@clack/prompts";

// Generate a new token similar to the original: "tr_pat_" + 40 lowercase alphanumeric chars
function generatePersonalToken(count: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "tr_pat_";
  for (let i = 0; i < count; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Generate tokens internally
const TRIGGER_TOKEN = nodeCrypto.randomBytes(32).toString("hex");
const COMMON_ID = "9ea0412ea8ef441ca03c7952d011ab56";
const key = generatePersonalToken(20);

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

  const personalToken = generatePersonalToken(40);
  await knex("PersonalAccessToken").insert({
    id,
    name: "cli",
    userId: COMMON_ID,
    updatedAt: new Date(),
    obfuscatedToken: personalToken,
    hashedToken: hashToken(personalToken),
    encryptedToken: {},
  });
  log.success("CLI personal access token created.");
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

export function encryptToken(value: string) {
  const nonce = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", TRIGGER_TOKEN, nonce);

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
  const envPath = path.join(triggerDir, ".env");
  log.step(`Loading environment variables from ${envPath}...`);
  const envVarsExpand =
    dotenvExpand.expand(dotenv.config({ path: envPath, processEnv: {} })).parsed || {};

  const knex = Knex({
    client: "pg", // Use PostgreSQL as the database client
    connection: envVarsExpand.DIRECT_URL?.replace("host.docker.internal", "localhost"), // Database connection URL from environment variable
  });

  try {
    log.step("Initializing Trigger.dev database...");

    // Create organization and user
    await createOrg(knex);

    // Create personal access token
    await createPersonalToken(knex);

    // Create project and return details
    const projectDetails = await createProject(knex);

    log.success("Trigger.dev database initialized successfully.");

    return {
      prodSecretKey: projectDetails.prodSecret,
      projectRefId: projectDetails.projectRef,
    };
  } catch (error) {
    log.error(`Initialization failed: ${error}`);
    throw new Error(`Initialization failed: ${error}`);
  }
}
