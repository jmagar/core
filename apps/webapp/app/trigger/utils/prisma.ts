import { PrismaClient } from "@prisma/client";
import { singleton } from "~/utils/singleton";

export const prisma = singleton("prisma", getClient);

function getClient() {
  const client = new PrismaClient();

  return client;
}
