import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { ClinicalProtocolStep } from '../src/modules/clinical-catalog/entities/clinical-protocol-step.entity';

describe('Clinical catalog entity mappings', () => {
  it('maps ClinicalProtocolStep.frequencyConfig to the frequencyId join column', () => {
    const joinColumn = getMetadataArgsStorage().joinColumns.find(
      (metadata) =>
        metadata.target === ClinicalProtocolStep &&
        metadata.propertyName === 'frequencyConfig',
    );

    expect(joinColumn?.name).toBe('frequencyId');
  });
});
