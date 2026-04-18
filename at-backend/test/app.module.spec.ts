import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { buildTypeOrmOptions } from '../src/app.module';

describe('buildTypeOrmOptions', () => {
  it('fails fast when DB_SYNC is enabled in production', () => {
    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'DB_SYNC') return 'true';
        return defaultValue;
      })
    } as unknown as ConfigService;

    expect(() => buildTypeOrmOptions(configService)).toThrow(
      'DB_SYNC não pode ser habilitado em produção; use migrations.'
    );
  });
});
