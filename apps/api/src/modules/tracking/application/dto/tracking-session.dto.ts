import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

/**
 * Os três números da colocação do dia.
 *
 * Todos opcionais, inclusive na hora de encerrar: pular a pergunta inteira é um caminho válido, e
 * um deles pode não ter saído ainda. A validação de faixa mora em `parsePlacementInput` (domain,
 * com spec) — aqui ficam só o tipo e os limites que o class-validator já resolve.
 */
export class PlacementFieldsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) placement?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100) satisfactionPercent?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) responseMinutes?: number | null;
}

export class StartSessionDto {
  @IsString()
  jobId!: string;

  /** Opcional — "esqueci de dar play" — inicia a sessão já com esse check-in em vez de agora. */
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class FinishSessionDto extends PlacementFieldsDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

/** A edição também mexe na colocação: um número lançado errado precisa ter conserto sem que a
 *  sessão inteira tenha que ser refeita. */
export class ManualEditSessionDto extends PlacementFieldsDto {
  @IsOptional() @IsDateString() checkIn?: string;
  @IsOptional() @IsDateString() checkOut?: string;
  @IsOptional() @IsString() notes?: string;
}

/** "Sessão retroativa" — registra um dia/horário que ficou de fora do cronômetro ao vivo. */
export class CreateManualSessionDto {
  @IsString()
  jobId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
