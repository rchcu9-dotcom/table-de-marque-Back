import { IsOptional, IsString } from 'class-validator';

export class DeleteMatchDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  deletedBy?: string;
}
