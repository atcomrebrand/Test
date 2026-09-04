import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto, LoginDto } from "./dto/auth.dto";
import { DEFAULT_CATEGORIES } from "../categories/default-categories";
import { decideRegistration, RegistrationDecision } from "./domain/registration-policy";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sign(user: { id: string; email: string }) {
    return this.jwt.sign({ sub: user.id, email: user.email });
  }

  /** Se dá pra criar conta agora. A tela de login usa isso pra esconder o link em vez de mandar a
   *  pessoa pra um formulário que vai recusar. */
  async registrationStatus(): Promise<RegistrationDecision> {
    const existingUsers = await this.prisma.user.count();
    return decideRegistration(process.env.ALLOW_REGISTRATION, existingUsers);
  }

  async register(dto: RegisterDto) {
    // Checado no servidor, sempre: esconder o link no frontend é conforto, não tranca — o endpoint
    // continua alcançável por curl.
    const decisao = await this.registrationStatus();
    if (!decisao.open) throw new ForbiddenException(decisao.reason);

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Este e-mail já está cadastrado.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        settings: { create: {} },
        categories: {
          create: DEFAULT_CATEGORIES.map((c) => ({ ...c, isDefault: true })),
        },
      },
    });

    return {
      token: this.sign(user),
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException("Credenciais inválidas.");

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Credenciais inválidas.");

    return {
      token: this.sign(user),
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { id: user.id, name: user.name, preferredName: user.preferredName, email: user.email };
  }
}
