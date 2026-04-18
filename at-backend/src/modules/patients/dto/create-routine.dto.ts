import { IsHhmmTime } from '../../../common/validators/is-hhmm-time.validator';

export class CreateRoutineDto {
  @IsHhmmTime()
  acordar: string;

  @IsHhmmTime()
  cafe: string;

  @IsHhmmTime()
  almoco: string;

  @IsHhmmTime()
  lanche: string;

  @IsHhmmTime()
  jantar: string;

  @IsHhmmTime()
  dormir: string;
}
