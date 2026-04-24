import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientModule } from './modules/patients/patient.module';
import { ClinicalCatalogModule } from './modules/clinical-catalog/clinical-catalog.module';
import { PatientPrescriptionModule } from './modules/patient-prescriptions/patient-prescription.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';

function isTrue(value: string | undefined): boolean {
  return value === 'true';
}

export function buildTypeOrmOptions(configService: ConfigService) {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const dbSyncEnabled = isTrue(configService.get<string>('DB_SYNC', 'false'));

  if (nodeEnv === 'production' && dbSyncEnabled) {
    throw new Error('DB_SYNC não pode ser habilitado em produção; use migrations.');
  }

  return {
    type: 'postgres' as const,
    host: configService.get<string>('DB_HOST'),
    port: Number(configService.get<string>('DB_PORT', '5432')),
    username: configService.get<string>('DB_USERNAME'),
    password: configService.get<string>('DB_PASSWORD'),
    database:
      configService.get<string>('DB_NAME') ??
      configService.get<string>('DB_DATABASE'),
    autoLoadEntities: true,
    synchronize: dbSyncEnabled,
    logging: isTrue(configService.get<string>('DB_LOGGING', 'false'))
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions
    }),
    PatientModule,
    ClinicalCatalogModule,
    PatientPrescriptionModule,
    SchedulingModule
  ]
})
export class AppModule {}
