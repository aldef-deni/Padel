import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const FORMATS = [
  'SINGLE_ELIMINATION',
  'ROUND_ROBIN',
  'GROUPS_KNOCKOUT',
] as const;
const STATUSES = [
  'DRAFT',
  'REGISTRATION',
  'ONGOING',
  'COMPLETED',
  'CANCELLED',
] as const;

export class CreateTournamentDto {
  @ApiProperty() @IsString() @IsNotEmpty() clubId: string;

  @ApiProperty({ example: 'Padel Cup Oktober' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Men Open' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: '2026-10-18' }) @IsDateString() startDate: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-10-19' })
  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsDateString()
  registrationDeadline?: string | null;

  @ApiProperty({ enum: FORMATS })
  @IsIn(FORMATS)
  format: (typeof FORMATS)[number];

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 2,
    maximum: 128,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(128)
  maxTeams?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: 'Rupiah' })
  @IsOptional()
  @IsInt()
  @Min(0)
  entryFee?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  prizeInfo?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    enum: [1, 2],
    default: 2,
    description: '1 = satu set, 2 = best of 3',
  })
  @IsOptional()
  @IsIn([1, 2])
  setsToWin?: number;

  @ApiPropertyOptional({ enum: [4, 6, 9], default: 6 })
  @IsOptional()
  @IsIn([4, 6, 9])
  gamesPerSet?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  superTiebreak?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  goldenPoint?: boolean;

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 16 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  groupCount?: number;

  @ApiPropertyOptional({ default: 2, minimum: 1, maximum: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  advancePerGroup?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  thirdPlaceMatch?: boolean;
}

export class UpdateTournamentDto extends PartialType(
  OmitType(CreateTournamentDto, ['clubId'] as const),
) {}

export class TournamentStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'REGISTRATION', 'CANCELLED'] })
  @IsIn(['DRAFT', 'REGISTRATION', 'CANCELLED'])
  status: 'DRAFT' | 'REGISTRATION' | 'CANCELLED';
}

export class ListTournamentsQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() clubId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class TeamDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Default: "Pemain 1 / Pemain 2"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string | null;

  @ApiProperty({ example: 'Budi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  player1Name: string;
  @ApiProperty({ example: 'Andi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  player2Name: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Akun pemain (opsional)',
  })
  @IsOptional()
  @IsString()
  player1Id?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  player2Id?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(128)
  seed?: number | null;

  @ApiPropertyOptional({ enum: ['REGISTERED', 'CONFIRMED', 'WITHDRAWN'] })
  @IsOptional()
  @IsIn(['REGISTERED', 'CONFIRMED', 'WITHDRAWN'])
  status?: 'REGISTERED' | 'CONFIRMED' | 'WITHDRAWN';

  @ApiPropertyOptional() @IsOptional() @IsBoolean() paid?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class UpdateTeamDto extends PartialType(TeamDto) {}

export class DrawDto {
  @ApiPropertyOptional({
    default: true,
    description: 'Acak tim tanpa unggulan',
  })
  @IsOptional()
  @IsBoolean()
  shuffle?: boolean;
}

export class ScheduleMatchDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  courtId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-10-18T09:00:00+07:00',
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string | null;
}

export class SetScoreDto {
  @ApiProperty() @IsInt() @Min(0) @Max(99) a: number;
  @ApiProperty() @IsInt() @Min(0) @Max(99) b: number;
}

export class MatchResultDto {
  @ApiPropertyOptional({
    type: [SetScoreDto],
    example: [
      { a: 6, b: 4 },
      { a: 7, b: 5 },
    ],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SetScoreDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  sets?: SetScoreDto[];

  @ApiPropertyOptional({
    enum: ['A', 'B'],
    description: 'Menang WO untuk tim A atau B',
  })
  @IsOptional()
  @IsIn(['A', 'B'])
  walkover?: 'A' | 'B';
}
