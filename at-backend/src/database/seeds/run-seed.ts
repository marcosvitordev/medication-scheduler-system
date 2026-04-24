import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ClinicalCatalogService } from '../../modules/clinical-catalog/clinical-catalog.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const clinicalCatalogService = app.get(ClinicalCatalogService);
  await clinicalCatalogService.seedCatalog();
  await app.close();
  console.log('Catálogo clínico padrão carregado com sucesso.');
}

run();
