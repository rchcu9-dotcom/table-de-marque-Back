import { IsEmail, IsString, MinLength } from 'class-validator';

export class DevLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  displayName: string;
}
