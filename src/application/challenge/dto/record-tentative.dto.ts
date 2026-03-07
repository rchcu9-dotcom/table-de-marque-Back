import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsArray,
  Min,
} from 'class-validator';

export class MetricsVitesseDto {
  @IsIn(['vitesse'])
  type: 'vitesse';

  @IsNumber()
  @Min(0)
  tempsMs: number;
}

export class MetricsTirDto {
  @IsIn(['tir'])
  type: 'tir';

  @IsArray()
  @IsNumber({}, { each: true })
  tirs: number[];

  @IsNumber()
  @Min(0)
  totalPoints: number;
}

export class MetricsGlisseCrosseDto {
  @IsIn(['glisse_crosse'])
  type: 'glisse_crosse';

  @IsNumber()
  @Min(0)
  tempsMs: number;

  @IsNumber()
  @Min(0)
  penalites: number;
}

export class RecordTentativeDto {
  @IsString()
  @IsNotEmpty()
  joueurId: string;

  /**
   * metrics is a discriminated union validated at the use-case level.
   * We accept any object here and let the use-case + repository enforce
   * the shape, since class-validator cannot natively handle discriminated
   * unions without a custom decorator.
   */
  metrics: Record<string, unknown>;
}
