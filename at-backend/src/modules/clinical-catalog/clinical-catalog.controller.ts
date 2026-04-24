import { Body, Controller, Get, Post } from '@nestjs/common';
import { ClinicalCatalogService } from './clinical-catalog.service';
import { CreateClinicalMedicationDto } from './dto/create-clinical-medication.dto';

@Controller('clinical-catalog')
export class ClinicalCatalogController {
  constructor(private readonly clinicalCatalogService: ClinicalCatalogService) {}

  @Post('seed')
  seed() {
    return this.clinicalCatalogService.seedCatalog();
  }

  @Get('groups')
  listGroups() {
    return this.clinicalCatalogService.listGroups();
  }

  @Post('medications')
  createMedication(@Body() dto: CreateClinicalMedicationDto) {
    return this.clinicalCatalogService.createMedication(dto);
  }

  @Get('medications')
  listMedications() {
    return this.clinicalCatalogService.listMedications();
  }
}
