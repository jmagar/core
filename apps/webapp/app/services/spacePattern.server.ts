import { prisma } from "~/db.server";

export class SpacePattern {
  async getSpacePatternsForSpace(spaceId: string, workspaceId: string) {
    const space = await prisma.space.findUnique({
      where: {
        id: spaceId,
        workspaceId,
      },
    });

    if (!space) {
      throw new Error("No space found");
    }

    const spacePatterns = await prisma.spacePattern.findMany({
      where: {
        spaceId: space?.id,
        deleted: null,
      },
    });

    return spacePatterns;
  }

  async getSpacePatternById(patternId: string, workspaceId: string) {
    const spacePattern = await prisma.spacePattern.findFirst({
      where: {
        id: patternId,
        space: {
          workspaceId,
        },
      },
    });

    return spacePattern;
  }

  async deleteSpacePattern(patternId: string, workspaceId: string) {
    const spacePattern = await prisma.spacePattern.findFirst({
      where: {
        id: patternId,
        space: {
          workspaceId,
        },
      },
    });

    if (!spacePattern) {
      throw new Error("Space pattern not found");
    }

    await prisma.spacePattern.update({
      where: {
        id: patternId,
      },
      data: {
        deleted: new Date(),
      },
    });

    return spacePattern;
  }
}
