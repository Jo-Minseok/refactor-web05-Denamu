import { validate } from 'class-validator';
import { StatisticQueryDto } from '../../../src/statistic/dto/statistic-query.dto';

describe('StatisticQueryDto', () => {
  it('실수를 입력한다.', async () => {
    // given
    const dto = new StatisticQueryDto();
    dto.limit = 1.1;

    // when
    const errors = await validate(dto);

    // then
    expect(errors.length).toBe(1);
    expect(errors[0].constraints).toHaveProperty(
      'isInt',
      '정수로 입력해주세요.',
    );
  });
  it('문자열을 입력한다.', async () => {
    // given
    const dto = new StatisticQueryDto();
    dto.limit = 'test' as unknown as number;

    // when
    const errors = await validate(dto);

    // then
    expect(errors.length).toBe(1);
    expect(errors[0].constraints).toHaveProperty(
      'isInt',
      '정수로 입력해주세요.',
    );
  });
  it('음수를 입력한다.', async () => {
    // given
    const dto = new StatisticQueryDto();
    dto.limit = -1;

    // when
    const errors = await validate(dto);

    // then
    expect(errors.length).toBe(1);
    expect(errors[0].constraints).toHaveProperty(
      'min',
      'limit 값은 1 이상이어야 합니다.',
    );
  });
});