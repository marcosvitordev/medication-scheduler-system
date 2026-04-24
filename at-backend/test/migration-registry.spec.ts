import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('Migration registry', () => {
  it('keeps only the consolidated baseline migration in the main migrations folder', () => {
    const migrationDir = join(__dirname, '..', 'src', 'database', 'migrations');
    const migrationFiles = readdirSync(migrationDir)
      .filter((file) => file.endsWith('.ts'))
      .sort();

    expect(migrationFiles).toEqual([
      '1763406000000-BaselineClinicalCatalogAndPatientPrescriptions.ts',
      '1763488800000-ConvertClinicalTimeColumnsToVarchar.ts',
      '1763571600000-NormalizePrescriptionPhaseDoseOverrides.ts',
      '1763662800000-HardenConflictAuditColumnsInScheduledDoses.ts',
      '1763749200000-AddBathTimeToPatientRoutines.ts',
    ]);
  });
});
