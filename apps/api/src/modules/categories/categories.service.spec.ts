import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { CategoriesService } from "./categories.service";
import { PrismaService } from "../../prisma/prisma.service";

function makePrisma(category: unknown): PrismaService {
  return { category: { findUnique: jest.fn().mockResolvedValue(category) } } as unknown as PrismaService;
}

describe("CategoriesService.assertUsable", () => {
  // The guard other modules call before storing a client-supplied categoryId. Purchases join the
  // category into their responses, so letting a foreign id through hands over its name and colour.
  it("accepts a category the user owns", async () => {
    const service = new CategoriesService(makePrisma({ id: "cat-1", userId: "user-1" }));
    await expect(service.assertUsable("user-1", "cat-1")).resolves.toBeUndefined();
  });

  it("rejects a category owned by someone else", async () => {
    const service = new CategoriesService(makePrisma({ id: "cat-1", userId: "outro-user" }));
    await expect(service.assertUsable("user-1", "cat-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects an id that matches no category at all", async () => {
    const service = new CategoriesService(makePrisma(null));
    await expect(service.assertUsable("user-1", "nao-existe")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("accepts a system default, which has no owner and is shared by everyone on purpose", async () => {
    // The whole point of this case: a guard that demanded userId === caller would reject the
    // built-in categories and break categorisation for every user in the app.
    const service = new CategoriesService(makePrisma({ id: "cat-padrao", userId: null, isDefault: true }));
    await expect(service.assertUsable("user-1", "cat-padrao")).resolves.toBeUndefined();
  });
});
