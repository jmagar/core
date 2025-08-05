import { z } from "zod";

const EnvironmentSchema = z.object({
  // Version
  VERSION: z.string().default("0.1.14"),

  // Database
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.string().default("5432"),
  TRIGGER_DB: z.string().default("trigger"),
  POSTGRES_USER: z.string().default("docker"),
  POSTGRES_PASSWORD: z.string().default("docker"),

  // Trigger database
  TRIGGER_TASKS_IMAGE: z.string().default("redplanethq/proj_core:latest"),

  // Node environment
  NODE_ENV: z
    .union([z.literal("development"), z.literal("production"), z.literal("test")])
    .default("development"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;
export const env = EnvironmentSchema.parse(process.env);
