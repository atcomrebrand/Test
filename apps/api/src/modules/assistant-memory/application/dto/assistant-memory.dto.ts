import { IsString, MinLength } from "class-validator";

export class CreateAssistantMemoryDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
