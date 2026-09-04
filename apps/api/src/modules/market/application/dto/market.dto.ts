import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";

/** Whatever the QR scan produced — the full NFC-e URL, or the 44-digit key typed by hand. Both are
 *  reduced to an access key server-side, so the client doesn't have to know the difference. */
export class ScanNotaDto {
  @IsString()
  @MinLength(10)
  code!: string;
}

export class ImportItemDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @IsString()
  storeCode?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;

  @Type(() => Number)
  @IsNumber()
  totalPrice!: number;
}

/** The confirmed contents of the preview screen — the user may have edited or removed lines, so
 *  the commit takes the reviewed list rather than re-fetching and trusting the portal again. */
export class CommitNotaDto {
  @IsString()
  @MinLength(1)
  storeName!: string;

  @IsOptional()
  @IsString()
  storeCnpj?: string;

  @IsOptional()
  @IsString()
  accessKey?: string;

  @IsDateString()
  purchaseDate!: string;

  @Type(() => Number)
  @IsNumber()
  totalAmount!: number;

  /** Carried over from the preview so the nota's own Lei 12.741 figure is what gets stored — it is
   *  not recomputed from the items, because there's nothing to recompute it from. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  taxAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportItemDto)
  items!: ImportItemDto[];
}

export class ListPurchasesQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

/** Une produtos sob um canônico. `ids` pode conter o próprio canônico — ele é ignorado, porque a
 *  tela naturalmente manda "os selecionados" e o escolhido está entre eles. */
export class MergeProductsDto {
  @IsString()
  @MinLength(1)
  canonicalId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}
