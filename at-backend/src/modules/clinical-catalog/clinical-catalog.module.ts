import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicalCatalogController } from './clinical-catalog.controller';
import { ClinicalCatalogService } from './clinical-catalog.service';
import { ClinicalGroup } from './entities/clinical-group.entity';
import { ClinicalInteractionRule } from './entities/clinical-interaction-rule.entity';
import { ClinicalMedication } from './entities/clinical-medication.entity';
import { ClinicalProtocolFrequency } from './entities/clinical-protocol-frequency.entity';
import { ClinicalProtocolStep } from './entities/clinical-protocol-step.entity';
import { ClinicalProtocol } from './entities/clinical-protocol.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicalMedication,
      ClinicalGroup,
      ClinicalProtocol,
      ClinicalProtocolFrequency,
      ClinicalProtocolStep,
      ClinicalInteractionRule,
    ]),
  ],
  controllers: [ClinicalCatalogController],
  providers: [ClinicalCatalogService],
  exports: [ClinicalCatalogService, TypeOrmModule],
})
export class ClinicalCatalogModule {}
