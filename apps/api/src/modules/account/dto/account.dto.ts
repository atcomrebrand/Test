import { IsIn, IsString, MinLength } from "class-validator";

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
