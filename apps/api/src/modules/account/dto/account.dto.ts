import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  /** String vazia limpa o apelido e volta a usar o nome do cadastro — por isso MinLength(0). */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  preferredName?: string;
}

/** Trocar o e-mail é trocar o identificador de login, então pede a senha: sem isso, uma sessão
 *  emprestada ou roubada vira tomada de conta com dois cliques. */
export class ChangeEmailDto {
  @IsEmail({}, { message: "E-mail inválido." })
  email!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  /** Mesma política do cadastro — não faz sentido a troca aceitar uma senha mais fraca do que a
   *  que o registro recusaria. */
  @IsString()
  @MinLength(10, { message: "A nova senha precisa ter pelo menos 10 caracteres." })
  @MaxLength(200)
  newPassword!: string;
}

export class ResetAccountDataDto {
  @IsString()
  @IsIn(["ZERAR"], { message: 'Digite exatamente "ZERAR" para confirmar.' })
  confirmText!: string;
}

export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  password!: string;
}
