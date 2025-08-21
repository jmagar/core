import { type SpacePattern } from "@core/types";
import { prisma } from "./prisma";

export const getSpace = async (spaceId: string) => {
  const space = await prisma.space.findFirst({
    where: {
      id: spaceId,
    },
  });

  return space;
};

export const createSpacePattern = async (
  spaceId: string,
  allPatterns: Omit<
    SpacePattern,
    "id" | "createdAt" | "updatedAt" | "spaceId"
  >[],
) => {
  return await prisma.spacePattern.createMany({
    data: allPatterns.map((pattern) => ({
      ...pattern,
      spaceId,
      userConfirmed: pattern.userConfirmed as any, // Temporary cast until Prisma client is regenerated
    })),
  });
};

export const updateSpace = async (summaryData: {
  spaceId: string;
  summary: string;
  themes: string[];
  statementCount: number;
}) => {
  return await prisma.space.update({
    where: {
      id: summaryData.spaceId,
    },
    data: {
      summary: summaryData.summary,
      themes: summaryData.themes,
      statementCount: summaryData.statementCount,
    },
  });
};
