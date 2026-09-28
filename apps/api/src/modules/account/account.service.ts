import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Wipes all financial data (cards, purchases, installments, payments, notifications,
   * custom categories) but keeps the login, preferences and default categories intact —
   * useful for restarting a trial/test run without losing the account itself.
   */
  async resetData(userId: string) {
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId } }),
      // Deleting purchases cascades installments, payments and their audit logs at the DB level.
      this.prisma.purchase.deleteMany({ where: { userId } }),
      this.prisma.auditLog.deleteMany({ where: { userId } }),
      this.prisma.card.deleteMany({ where: { userId } }),
      this.prisma.category.deleteMany({ where: { userId, isDefault: false } }),
    ]);

    return { success: true };
  }

  /** Nome e apelido não pedem senha: errar aqui não dá acesso a nada e é desfeito digitando de
   *  novo, ao contrário de e-mail e senha, que mexem em como se entra na conta. */
  async updateProfile(userId: string, dto: { name?: string; preferredName?: string }) {
    const data: { name?: string; preferredName?: string | null } = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    // Campo apagado volta a null em vez de virar string vazia, senão o assistente passaria a
    // chamar a pessoa de "" achando que tem um apelido configurado.
    if (dto.preferredName !== undefined) data.preferredName = dto.preferredName.trim() || null;

    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return { id: user.id, name: user.name, preferredName: user.preferredName, email: user.email };
  }

  async changeEmail(userId: string, novoEmail: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Senha incorreta.");

    const email = novoEmail.trim().toLowerCase();
    if (email === user.email) return { id: user.id, name: user.name, preferredName: user.preferredName, email: user.email };

    // Checado antes pra devolver uma mensagem que se entende, em vez do erro de unique do Prisma
    // virando 500. Há uma corrida teórica entre a checagem e o update; o unique do banco continua
    // sendo a garantia de verdade, essa checagem é só pela mensagem.
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException("Já existe uma conta com esse e-mail.");

    const atualizado = await this.prisma.user.update({ where: { id: userId }, data: { email } });
    return { id: atualizado.id, name: atualizado.name, preferredName: atualizado.preferredName, email: atualizado.email };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Senha atual incorreta.");
    if (currentPassword === newPassword) throw new BadRequestException("A nova senha precisa ser diferente da atual.");

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } });
    return { success: true };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Senha incorreta.");

    // All relations are FK onDelete: Cascade from User, so this removes everything.
    await this.prisma.user.delete({ where: { id: userId } });
    return { success: true };
  }
}
