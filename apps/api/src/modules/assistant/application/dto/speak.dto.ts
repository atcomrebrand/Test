import { IsString, MaxLength } from "class-validator";

export class SpeakDto {
  @IsString()
  @MaxLength(4000)
  text!: string;

  @IsString()
  voiceId!: string;
}
