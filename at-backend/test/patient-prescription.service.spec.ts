import 'reflect-metadata';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { MonthlySpecialReference } from '../src/common/enums/monthly-special-reference.enum';
import { OcularLaterality } from '../src/common/enums/ocular-laterality.enum';
import { OticLaterality } from '../src/common/enums/otic-laterality.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import { PatientPrescriptionPhase } from '../src/modules/patient-prescriptions/entities/patient-prescription-phase.entity';
import { PatientPrescriptionService } from '../src/modules/patient-prescriptions/patient-prescription.service';

describe('PatientPrescriptionService', () => {
  function createService() {
    const repository = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const prescriptionRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => ({ ...entity, id: 'rx-1' })),
      findOne: jest.fn(),
    };

    const medicationRepository = {
      create: jest.fn((entity) => entity),
    };

    const phaseRepository = {
      create: jest.fn((entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const phaseDoseRepository = {
      create: jest.fn((entity) => entity),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        const entityName = typeof entity === 'function' ? entity.name : String(entity);
        if (entityName === 'PatientPrescription') return prescriptionRepository;
        if (entityName === 'PatientPrescriptionMedication') return medicationRepository;
        if (entityName === 'PatientPrescriptionPhase') return phaseRepository;
        if (entityName === 'PatientPrescriptionPhaseDose') return phaseDoseRepository;
        return repository;
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const patientService = {
      findById: jest.fn(async (id: string) => ({
        id,
        fullName: 'Paciente Teste',
      })),
    };

    const schedulingService = {
      buildAndPersistSchedule: jest.fn(async (prescription) => ({
        patientId: prescription.patient.id,
        prescriptionId: prescription.id,
        medications: prescription.medications.map((medication) => ({
          prescriptionMedicationId: medication.id ?? 'pm-1',
          sourceClinicalMedicationId: medication.sourceClinicalMedicationId,
          sourceProtocolId: medication.sourceProtocolId,
          medicationName:
            medication.medicationSnapshot.commercialName ??
            medication.medicationSnapshot.activePrinciple,
          activePrinciple: medication.medicationSnapshot.activePrinciple,
          presentation: medication.medicationSnapshot.presentation,
          administrationRoute: medication.medicationSnapshot.administrationRoute,
          usageInstructions: medication.medicationSnapshot.usageInstructions,
          groupCode: medication.protocolSnapshot.groupCode,
          protocolCode: medication.protocolSnapshot.code,
          phases: [],
        })),
      })),
    };

    const service = new PatientPrescriptionService(
      repository as never,
      dataSource as never,
      patientService as never,
      { findMedicationById: jest.fn() } as never,
      schedulingService as never,
    );

    return {
      service,
      repository,
      prescriptionRepository,
      schedulingService,
      patientService,
      clinicalCatalogService:
        (service as unknown as { clinicalCatalogService: { findMedicationById: jest.Mock } })
          .clinicalCatalogService,
      phaseDoseRepository,
    };
  }

  function buildClinicalMedicationWithProtocol(protocolOverrides: Record<string, unknown> = {}) {
    return {
      id: 'clinical-1',
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana',
      presentation: 'Comprimido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
          ...protocolOverrides,
        },
      ],
    };
  }

  function mockLoadedPrescriptionForLaterality(
    prescriptionRepository: { findOne: jest.Mock },
    phaseOverrides: Record<string, unknown> = {},
  ) {
    prescriptionRepository.findOne.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        patient: { id: 'patient-1' },
        medications: [
          {
            id: 'prescription-medication-1',
            sourceClinicalMedicationId: 'clinical-1',
            sourceProtocolId: 'protocol-1',
            medicationSnapshot: {
              id: 'clinical-1',
              commercialName: 'MED TESTE',
              activePrinciple: 'Principio ativo',
              presentation: 'Frasco',
              administrationRoute: 'TESTE',
              usageInstructions: 'Conforme orientacao.',
            },
            protocolSnapshot: {
              id: 'protocol-1',
              code: 'GROUP_I_STANDARD',
              name: 'Grupo I padrao',
              description: 'Protocolo base',
              groupCode: GroupCode.GROUP_I,
              priority: 0,
              isDefault: true,
              frequencies: [
                {
                  frequency: 1,
                  steps: [
                    {
                      doseLabel: 'D1',
                      anchor: ClinicalAnchor.CAFE,
                      offsetMinutes: 0,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                  ],
                },
              ],
            },
            interactionRulesSnapshot: [],
            phases: [
              {
                id: 'phase-1',
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                doseValue: '1',
                doseUnit: DoseUnit.GOTAS,
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                ...phaseOverrides,
              },
            ],
          },
        ],
      }),
    );
  }

  function buildPhasePayload(overrides: Record<string, unknown> = {}) {
    return {
      phaseOrder: 1,
      frequency: 1,
      sameDosePerSchedule: true,
      doseAmount: '1 COMP',
      doseValue: '1',
      doseUnit: DoseUnit.COMP,
      recurrenceType: TreatmentRecurrence.DAILY,
      treatmentDays: 10,
      continuousUse: false,
      manualAdjustmentEnabled: false,
      ...overrides,
    } as never;
  }

  function buildGlycemiaRanges() {
    return [
      { minimum: 70, maximum: 140, doseValue: '0', doseUnit: DoseUnit.UI },
      { minimum: 141, maximum: 180, doseValue: '2', doseUnit: DoseUnit.UI },
      { minimum: 181, maximum: 220, doseValue: '4', doseUnit: DoseUnit.UI },
    ];
  }

  async function expectDomainErrorMessage(
    pending: Promise<unknown>,
    expectedMessage: string,
  ) {
    try {
      await pending;
      throw new Error('Expected UnprocessableEntityException to be thrown.');
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      expect((error as Error).message).toContain(expectedMessage);
    }
  }

  it('creates a patient prescription from clinicalMedicationId and protocolId with full snapshots', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    const clinicalMedication = {
      id: 'clinical-1',
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana potassica',
      presentation: 'Comprimido revestido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I padrao',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              targetProtocolCode: undefined,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              windowMinutes: undefined,
              priority: 0,
            },
          ],
        },
      ],
    };

    clinicalCatalogService.findMedicationById.mockResolvedValue(clinicalMedication);
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'prescription-medication-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana potassica',
            presentation: 'Comprimido revestido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescricao.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I padrao',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_I,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              priority: 0,
            },
          ],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    const result = await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-1',
          protocolId: 'protocol-1',
          phases: [
            {
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
    const scheduledPrescription = schedulingService.buildAndPersistSchedule.mock.calls[0][0];
    expect(scheduledPrescription.medications[0]).toMatchObject({
      sourceClinicalMedicationId: 'clinical-1',
      sourceProtocolId: 'protocol-1',
      medicationSnapshot: {
        commercialName: 'LOSARTANA',
        activePrinciple: 'Losartana potassica',
      },
      protocolSnapshot: {
        code: 'GROUP_I_STANDARD',
        groupCode: GroupCode.GROUP_I,
      },
      interactionRulesSnapshot: [
        {
          interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
          targetGroupCode: GroupCode.GROUP_III_SAL,
        },
      ],
    });
    expect(result).toMatchObject({
      patientId: 'patient-1',
      prescriptionId: 'rx-1',
    });
  });

  it('keeps prescription snapshots stable even if the clinical catalog object is mutated later', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    const clinicalMedication = {
      id: 'clinical-1',
      commercialName: 'SUCRAFILM',
      activePrinciple: 'Sucralfato',
      presentation: 'Suspensao oral',
      administrationRoute: 'VO',
      usageInstructions: 'Protocolo original.',
      protocols: [
        {
          id: 'protocol-1',
          code: 'GROUP_II_SUCRA',
          name: 'Sucralfato',
          description: 'Protocolo base',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_II_SUCRA },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.ACORDAR,
                  offsetMinutes: 120,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
        },
      ],
    };

    clinicalCatalogService.findMedicationById.mockResolvedValue(clinicalMedication);
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'med-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'SUCRAFILM',
            activePrinciple: 'Sucralfato',
            presentation: 'Suspensao oral',
            administrationRoute: 'VO',
            usageInstructions: 'Protocolo original.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_II_SUCRA',
            name: 'Sucralfato',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_II_SUCRA,
            priority: 0,
            isDefault: true,
            frequencies: [],
          },
          interactionRulesSnapshot: [],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-1',
          protocolId: 'protocol-1',
          phases: [
            {
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    const capturedSnapshot =
      schedulingService.buildAndPersistSchedule.mock.calls[0][0].medications[0]
        .medicationSnapshot;

    clinicalMedication.activePrinciple = 'Mudou no catalogo';
    clinicalMedication.usageInstructions = 'Mudou depois da prescricao';

    expect(capturedSnapshot).toMatchObject({
      activePrinciple: 'Sucralfato',
      usageInstructions: 'Protocolo original.',
    });
  });

  it('rejects a phase whose frequency is not supported by the chosen protocol', async () => {
    const { service, clinicalCatalogService } = createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol(),
    );

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 2,
                sameDosePerSchedule: true,
                doseAmount: '1 COMP',
                doseValue: '1',
                doseUnit: DoseUnit.COMP,
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects a recurrence type that is not allowed by the protocol frequency', async () => {
    const { service, clinicalCatalogService } = createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol({
        frequencies: [
          {
            frequency: 1,
            allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
    );

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 COMP',
                doseValue: '1',
                doseUnit: DoseUnit.COMP,
                recurrenceType: TreatmentRecurrence.WEEKLY,
                weeklyDay: 'MONDAY',
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts weekly bifosfonate prescription using the default BIFOS protocol', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      id: 'clinical-bifos',
      commercialName: 'ALENDRONATO',
      activePrinciple: 'Alendronato de sodio',
      presentation: 'Comprimido',
      administrationRoute: 'VO',
      usageInstructions: 'Administrar em jejum com agua.',
      protocols: [
        {
          id: 'protocol-bifos',
          code: 'GROUP_II_BIFOS_STANDARD',
          name: 'Grupo II Bifosfonatos',
          description: 'Protocolos para bifosfonatos em jejum.',
          priority: 0,
          isDefault: true,
          group: { code: GroupCode.GROUP_II_BIFOS },
          frequencies: [
            {
              frequency: 1,
              label: '1x por semana',
              allowedRecurrenceTypes: [
                TreatmentRecurrence.DAILY,
                TreatmentRecurrence.WEEKLY,
              ],
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.ACORDAR,
                  offsetMinutes: -60,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
        },
      ],
    });
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'prescription-medication-1',
          sourceClinicalMedicationId: 'clinical-bifos',
          sourceProtocolId: 'protocol-bifos',
          medicationSnapshot: {
            id: 'clinical-bifos',
            commercialName: 'ALENDRONATO',
            activePrinciple: 'Alendronato de sodio',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Administrar em jejum com agua.',
          },
          protocolSnapshot: {
            id: 'protocol-bifos',
            code: 'GROUP_II_BIFOS_STANDARD',
            name: 'Grupo II Bifosfonatos',
            description: 'Protocolos para bifosfonatos em jejum.',
            groupCode: GroupCode.GROUP_II_BIFOS,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                label: '1x por semana',
                allowedRecurrenceTypes: [
                  TreatmentRecurrence.DAILY,
                  TreatmentRecurrence.WEEKLY,
                ],
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: -60,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.WEEKLY,
              weeklyDay: 'SEGUNDA',
              treatmentDays: 30,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-bifos',
          protocolId: 'protocol-bifos',
          phases: [
            {
              phaseOrder: 1,
              frequency: 1,
              sameDosePerSchedule: true,
              doseAmount: '1 COMP',
              doseValue: '1',
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.WEEKLY,
              weeklyDay: 'SEGUNDA',
              treatmentDays: 30,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
    const scheduledPrescription = schedulingService.buildAndPersistSchedule.mock.calls[0][0];
    expect(scheduledPrescription.medications[0]).toMatchObject({
      medicationSnapshot: {
        commercialName: 'ALENDRONATO',
      },
      protocolSnapshot: {
        code: 'GROUP_II_BIFOS_STANDARD',
        groupCode: GroupCode.GROUP_II_BIFOS,
      },
      phases: [
        expect.objectContaining({
          frequency: 1,
          recurrenceType: TreatmentRecurrence.WEEKLY,
          weeklyDay: 'SEGUNDA',
        }),
      ],
    });
  });

  it('rejects PRN when the protocol frequency does not allow it', async () => {
    const { service, clinicalCatalogService } = createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol({
        frequencies: [
          {
            frequency: 1,
            allowedRecurrenceTypes: [TreatmentRecurrence.DAILY, TreatmentRecurrence.PRN],
            allowsPrn: false,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
    );

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 COMP',
                doseValue: '1',
                doseUnit: DoseUnit.COMP,
                recurrenceType: TreatmentRecurrence.PRN,
                prnReason: 'PAIN' as never,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects variable dose by schedule when the protocol frequency does not allow it', async () => {
    const { service, clinicalCatalogService } = createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol({
        frequencies: [
          {
            frequency: 2,
            allowsVariableDoseBySchedule: false,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
              {
                doseLabel: 'D2',
                anchor: ClinicalAnchor.JANTAR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
    );

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 2,
                sameDosePerSchedule: false,
                perDoseOverrides: [
                  { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
                  { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
                ],
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts recurrence, PRN and variable dose combinations when the protocol frequency allows them', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol({
        frequencies: [
          {
            frequency: 2,
            allowedRecurrenceTypes: [TreatmentRecurrence.PRN],
            allowsPrn: true,
            allowsVariableDoseBySchedule: true,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
              {
                doseLabel: 'D2',
                anchor: ClinicalAnchor.JANTAR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
    );
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'prescription-medication-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescricao.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_I,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 2,
                allowedRecurrenceTypes: [TreatmentRecurrence.PRN],
                allowsPrn: true,
                allowsVariableDoseBySchedule: true,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 2,
              sameDosePerSchedule: false,
              perDoseOverrides: [
                { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
                { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
              ],
              recurrenceType: TreatmentRecurrence.PRN,
              prnReason: 'PAIN',
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            },
          ],
        },
      ],
    }));

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 2,
                sameDosePerSchedule: false,
                perDoseOverrides: [
                  { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
                  { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
                ],
                recurrenceType: TreatmentRecurrence.PRN,
                prnReason: 'PAIN' as never,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).resolves.toMatchObject({
      patientId: 'patient-1',
      prescriptionId: 'rx-1',
    });

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('accepts ophthalmic prescription phase with ocular laterality (XALACOM equivalent)', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      commercialName: 'XALACOM',
      administrationRoute: 'VIA OCULAR',
      isOphthalmic: true,
      isOtic: false,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      ocularLaterality: OcularLaterality.RIGHT_EYE,
      oticLaterality: undefined,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                doseValue: '1',
                doseUnit: DoseUnit.GOTAS,
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                ocularLaterality: OcularLaterality.RIGHT_EYE,
              } as never,
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('accepts otic prescription phase with otic laterality (OTOCIRIAX equivalent)', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      commercialName: 'OTOCIRIAX',
      administrationRoute: 'VIA OTOLOGICA',
      isOphthalmic: false,
      isOtic: true,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      ocularLaterality: undefined,
      oticLaterality: OticLaterality.BOTH_EARS,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                doseValue: '1',
                doseUnit: DoseUnit.GOTAS,
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                oticLaterality: OticLaterality.BOTH_EARS,
              } as never,
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('rejects ophthalmic medication without ocular laterality', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: true,
      isOtic: false,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects ophthalmic medication with otic laterality', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: true,
      isOtic: false,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                oticLaterality: OticLaterality.RIGHT_EAR,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects otic medication without otic laterality', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: false,
      isOtic: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects non ocular/otic medication when laterality is provided', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: false,
      isOtic: false,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                ocularLaterality: OcularLaterality.LEFT_EYE,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects medication flagged as both ophthalmic and otic', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: true,
      isOtic: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              {
                phaseOrder: 1,
                frequency: 1,
                sameDosePerSchedule: true,
                doseAmount: '1 GOTA',
                recurrenceType: TreatmentRecurrence.DAILY,
                treatmentDays: 10,
                continuousUse: false,
                manualAdjustmentEnabled: false,
                ocularLaterality: OcularLaterality.RIGHT_EYE,
                oticLaterality: OticLaterality.RIGHT_EAR,
              } as never,
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts rapid insulin equivalent with valid glycemia scale', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();
    const glycemiaScaleRanges = buildGlycemiaRanges();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      commercialName: 'INSULINA RAPIDA',
      administrationRoute: 'SC',
      requiresGlycemiaScale: true,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      doseAmount: '2 UI',
      doseValue: '2',
      doseUnit: DoseUnit.UI,
      glycemiaScaleRanges,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                doseAmount: '2 UI',
                doseValue: '2',
                doseUnit: DoseUnit.UI,
                glycemiaScaleRanges,
              }),
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('accepts ultra-rapid insulin equivalent with valid glycemia scale', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();
    const glycemiaScaleRanges = buildGlycemiaRanges();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      commercialName: 'INSULINA ULTRA RAPIDA',
      administrationRoute: 'SC',
      requiresGlycemiaScale: true,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      doseAmount: '3 UI',
      doseValue: '3',
      doseUnit: DoseUnit.UI,
      glycemiaScaleRanges,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                doseAmount: '3 UI',
                doseValue: '3',
                doseUnit: DoseUnit.UI,
                glycemiaScaleRanges,
              }),
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('rejects medication that requires glycemia scale when phase does not provide ranges', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [buildPhasePayload()],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects glycemia scale for medication that is not compatible', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: false,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                glycemiaScaleRanges: buildGlycemiaRanges(),
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects glycemia scale ranges with overlap', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                glycemiaScaleRanges: [
                  { minimum: 70, maximum: 140, doseValue: '0', doseUnit: DoseUnit.UI },
                  { minimum: 140, maximum: 180, doseValue: '2', doseUnit: DoseUnit.UI },
                ],
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects glycemia scale ranges with gap', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                glycemiaScaleRanges: [
                  { minimum: 70, maximum: 140, doseValue: '0', doseUnit: DoseUnit.UI },
                  { minimum: 142, maximum: 180, doseValue: '2', doseUnit: DoseUnit.UI },
                ],
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects glycemia scale ranges when maximum is lower than minimum', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                glycemiaScaleRanges: [
                  { minimum: 180, maximum: 140, doseValue: '2', doseUnit: DoseUnit.UI },
                ],
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts monthly contraceptive equivalent with monthly special rule (PERLUTAN equivalent)', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      commercialName: 'PERLUTAN',
      isContraceptiveMonthly: true,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      recurrenceType: TreatmentRecurrence.MONTHLY,
      monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
      monthlySpecialBaseDate: '2026-02-20',
      monthlySpecialOffsetDays: 12,
      monthlyDay: undefined,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 12,
                monthlyDay: undefined,
              }),
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('rejects monthly contraceptive with non-positive monthlySpecialOffsetDays', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: true,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 0,
                monthlyDay: undefined,
              }),
            ],
          },
        ],
      }),
      'Fase 1: monthlySpecialOffsetDays deve ser maior que zero quando monthlySpecial* for informado.',
    );
  });

  it('rejects monthly contraceptive with recurrenceType different from MONTHLY', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: true,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.DAILY,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 8,
                monthlyDay: undefined,
              }),
            ],
          },
        ],
      }),
      'Fase 1: recurrenceType =DAILY é inválido para medicamento clinical-1 (isContraceptiveMonthly=true exige MONTHLY).',
    );
  });

  it('rejects monthly contraceptive without monthly special rule', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects monthly contraceptive when monthlyDay is provided', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: true,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
                monthlyDay: 8,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 8,
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects monthly special fields for non-contraceptive medication', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: false,
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 8,
              }),
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('accepts manualAdjustmentEnabled=true when medication supports manual adjustment', async () => {
    const { service, prescriptionRepository, schedulingService, clinicalCatalogService } =
      createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      supportsManualAdjustment: true,
    });
    mockLoadedPrescriptionForLaterality(prescriptionRepository, {
      manualAdjustmentEnabled: true,
      manualTimes: ['08:00'],
    });

    await expect(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                manualAdjustmentEnabled: true,
                manualTimes: ['08:00'],
              }),
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
  });

  it('rejects manualAdjustmentEnabled=true when medication does not support manual adjustment with detailed message', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      supportsManualAdjustment: false,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                manualAdjustmentEnabled: true,
                manualTimes: ['08:00'],
              }),
            ],
          },
        ],
      }),
      'Fase 1: manualAdjustmentEnabled=true é inválido para medicamento clinical-1 (supportsManualAdjustment=false).',
    );
  });

  it('rejects manualTimes when manualAdjustmentEnabled=false with detailed message', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      supportsManualAdjustment: true,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                manualAdjustmentEnabled: false,
                manualTimes: ['08:00'],
              }),
            ],
          },
        ],
      }),
      'Fase 1: manualTimes é inválido quando manualAdjustmentEnabled=false para medicamento clinical-1.',
    );
  });

  it('returns detailed laterality message for ophthalmic incompatibility', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isOphthalmic: true,
      isOtic: false,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                ocularLaterality: OcularLaterality.RIGHT_EYE,
                oticLaterality: OticLaterality.RIGHT_EAR,
              }),
            ],
          },
        ],
      }),
      'Fase 1: oticLaterality é inválido para medicamento clinical-1 (isOphthalmic=true).',
    );
  });

  it('returns detailed glycemia message for incompatible medication', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      requiresGlycemiaScale: false,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                glycemiaScaleRanges: buildGlycemiaRanges(),
              }),
            ],
          },
        ],
      }),
      'Fase 1: glycemiaScaleRanges é inválido para medicamento clinical-1 (requiresGlycemiaScale=false).',
    );
  });

  it('returns detailed monthly-special message for non-contraceptive medication', async () => {
    const { service, clinicalCatalogService } = createService();
    clinicalCatalogService.findMedicationById.mockResolvedValue({
      ...buildClinicalMedicationWithProtocol(),
      isContraceptiveMonthly: false,
    });

    await expectDomainErrorMessage(
      service.create({
        patientId: 'patient-1',
        startedAt: '2026-04-21',
        medications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [
              buildPhasePayload({
                recurrenceType: TreatmentRecurrence.MONTHLY,
                monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
                monthlySpecialBaseDate: '2026-02-20',
                monthlySpecialOffsetDays: 8,
              }),
            ],
          },
        ],
      }),
      'Fase 1: monthlySpecial* é inválido para medicamento clinical-1 (isContraceptiveMonthly=false).',
    );
  });

  function buildUpsertPhase(overrides: Record<string, unknown> = {}) {
    return {
      frequency: 1,
      sameDosePerSchedule: true,
      doseAmount: '1 COMP',
      doseValue: '1',
      doseUnit: DoseUnit.COMP,
      recurrenceType: TreatmentRecurrence.DAILY,
      treatmentDays: 10,
      continuousUse: false,
      manualAdjustmentEnabled: false,
      ...overrides,
    };
  }

  function buildPrescriptionState(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rx-1',
      patient: { id: 'patient-1' },
      startedAt: '2026-04-21',
      status: 'ACTIVE',
      medications: [
        {
          id: 'med-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescricao.',
            supportsManualAdjustment: true,
            isOphthalmic: false,
            isOtic: false,
            requiresGlycemiaScale: false,
            isContraceptiveMonthly: false,
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_I,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [],
          phases: [
            {
              id: 'phase-1',
              phaseOrder: 1,
              ...buildUpsertPhase(),
            },
          ],
        },
      ],
      ...overrides,
    };
  }

  function buildClinicalMedicationForUpdate(clinicalMedicationId: string) {
    const baseProtocolsByMedication: Record<
      string,
      Array<{ id: string; groupCode: GroupCode; code: string }>
    > = {
      'clinical-1': [
        { id: 'protocol-1', groupCode: GroupCode.GROUP_I, code: 'PROTOCOLO-protocol-1' },
        {
          id: 'protocol-1-alt',
          groupCode: GroupCode.GROUP_III,
          code: 'PROTOCOLO-protocol-1-alt',
        },
      ],
      'clinical-2': [
        { id: 'protocol-2', groupCode: GroupCode.GROUP_II, code: 'PROTOCOLO-protocol-2' },
      ],
    };

    const protocols = baseProtocolsByMedication[clinicalMedicationId] ?? [
      { id: 'protocol-1', groupCode: GroupCode.GROUP_I, code: 'PROTOCOLO-protocol-1' },
    ];

    return {
      id: clinicalMedicationId,
      commercialName: `MED-${clinicalMedicationId}`,
      activePrinciple: `Principio-${clinicalMedicationId}`,
      presentation: 'Comprimido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      supportsManualAdjustment: true,
      protocols: protocols.map((protocol) => ({
          id: protocol.id,
          code: protocol.code,
          name: `Protocolo ${protocol.id}`,
          description: 'Protocolo update',
          priority: 0,
          isDefault: true,
          group: { code: protocol.groupCode },
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
          interactionRules: [],
        })),
    };
  }

  function createUpdateServiceHarness(initialState?: Record<string, unknown>) {
    let nextMedicationId = 10;
    let nextPhaseId = 50;
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

    const state: { prescription: any } = {
      prescription: buildPrescriptionState(initialState) as any,
    };

    const ensureMedicationId = (id?: string) => id ?? `med-new-${nextMedicationId++}`;
    const ensurePhaseId = (id?: string) => id ?? `phase-new-${nextPhaseId++}`;

    const normalizePrescription = (prescription: Record<string, unknown>) => {
      const normalized = clone(prescription) as Record<string, unknown> & {
        medications: Array<Record<string, unknown> & { phases: Array<Record<string, unknown>> }>;
      };
      normalized.medications = normalized.medications.map((medication) => ({
        ...medication,
        id: ensureMedicationId(medication.id as string | undefined),
        phases: medication.phases.map((phase) => ({
          ...phase,
          id: ensurePhaseId(phase.id as string | undefined),
        })),
      }));
      return normalized;
    };

    const prescriptionRepository = {
      find: jest.fn(),
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => {
        state.prescription = normalizePrescription(entity as Record<string, unknown>);
        return clone(state.prescription);
      }),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id !== (state.prescription.id as string)) return null;
        return clone(state.prescription);
      }),
    };

    const medicationRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: ensureMedicationId((entity as { id?: string }).id),
        phases: (entity as { phases?: Array<Record<string, unknown>> }).phases?.map((phase) => ({
          ...phase,
          id: ensurePhaseId(phase.id as string | undefined),
        })),
      })),
      save: jest.fn(async (entity) => {
        const medication = {
          ...clone(entity),
          id: ensureMedicationId((entity as { id?: string }).id),
          phases: ((entity as { phases?: Array<Record<string, unknown>> }).phases ?? []).map(
            (phase) => ({
              ...phase,
              id: ensurePhaseId(phase.id as string | undefined),
            }),
          ),
        };
        const medications =
          (state.prescription.medications as Array<Record<string, unknown>>) ?? [];
        const index = medications.findIndex((item) => item.id === medication.id);
        if (index >= 0) {
          medications[index] = medication;
        } else {
          medications.push(medication);
        }
        state.prescription.medications = medications;
        return clone(medication);
      }),
      remove: jest.fn(async (entities: Array<{ id: string }>) => {
        const idsToRemove = new Set(entities.map((item) => item.id));
        state.prescription.medications = (
          state.prescription.medications as Array<Record<string, unknown>>
        ).filter((medication) => !idsToRemove.has(medication.id as string));
        return entities;
      }),
    };

    const phaseRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: ensurePhaseId((entity as { id?: string }).id),
      })),
      delete: jest.fn(async (criteria: string[] | string) => {
        const ids = Array.isArray(criteria) ? criteria : [criteria];
        const removeIds = new Set(ids);
        state.prescription.medications = (
          state.prescription.medications as Array<
            Record<string, unknown> & { phases?: Array<Record<string, unknown>> }
          >
        ).map((medication) => ({
          ...medication,
          phases: (medication.phases ?? []).filter(
            (phase) => !removeIds.has(phase.id as string),
          ),
        }));
        return { affected: ids.length };
      }),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        const entityName = typeof entity === 'function' ? entity.name : String(entity);
        if (entityName === 'PatientPrescription') return prescriptionRepository;
        if (entityName === 'PatientPrescriptionMedication') return medicationRepository;
        if (entityName === 'PatientPrescriptionPhase') return phaseRepository;
        return prescriptionRepository;
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const clinicalCatalogService = {
      findMedicationById: jest.fn(async (clinicalMedicationId: string) => {
        if (clinicalMedicationId === 'clinical-2') {
          return buildClinicalMedicationForUpdate('clinical-2');
        }
        return buildClinicalMedicationForUpdate('clinical-1');
      }),
    };

    const schedulingService = {
      buildAndPersistSchedule: jest.fn(async (prescription) => ({
        prescriptionId: prescription.id,
        medicationCount: prescription.medications.length,
      })),
    };

    const service = new PatientPrescriptionService(
      prescriptionRepository as never,
      dataSource as never,
      { findById: jest.fn() } as never,
      clinicalCatalogService as never,
      schedulingService as never,
    );

    return {
      service,
      state,
      prescriptionRepository,
      medicationRepository,
      phaseRepository,
      schedulingService,
      clinicalCatalogService,
    };
  }

  it('appends phases and recalculates schedule', async () => {
    const { service, state, schedulingService } = createUpdateServiceHarness();

    const result = await service.appendPhases('rx-1', 'med-1', {
      phases: [buildUpsertPhase({ treatmentDays: 7 })],
    } as never);

    const phases = (
      state.prescription.medications as Array<{ id: string; phases: Array<{ phaseOrder: number }> }>
    )[0].phases;
    expect(phases.map((phase) => phase.phaseOrder)).toEqual([1, 2]);
    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ prescriptionId: 'rx-1', medicationCount: 1 });
  });

  it('updates startedAt and recalculates schedule', async () => {
    const { service, state, schedulingService } = createUpdateServiceHarness();

    const result = await service.updatePrescription('rx-1', {
      startedAt: '2026-06-01',
    } as never);

    expect(state.prescription.startedAt).toBe('2026-06-01');
    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalledTimes(1);
    expect(schedulingService.buildAndPersistSchedule.mock.calls[0][0].startedAt).toBe(
      '2026-06-01',
    );
    expect(result).toEqual({ prescriptionId: 'rx-1', medicationCount: 1 });
  });

  it('allows swapping protocolId on an existing prescription medication', async () => {
    const { service, state } = createUpdateServiceHarness();

    await service.updatePrescription('rx-1', {
      updateMedications: [
        {
          prescriptionMedicationId: 'med-1',
          protocolId: 'protocol-1-alt',
        },
      ],
    } as never);

    const medication = state.prescription.medications[0];
    expect(medication.sourceProtocolId).toBe('protocol-1-alt');
    expect(medication.protocolSnapshot.id).toBe('protocol-1-alt');
    expect(medication.protocolSnapshot.code).toBe('PROTOCOLO-protocol-1-alt');
  });

  it('rejects protocol swap when protocolId is not available for the medication', async () => {
    const { service } = createUpdateServiceHarness();

    await expect(
      service.updatePrescription('rx-1', {
        updateMedications: [
          {
            prescriptionMedicationId: 'med-1',
            protocolId: 'protocol-inexistente',
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates an existing phase by phaseId and keeps sequential order', async () => {
    const { service, state } = createUpdateServiceHarness();

    await service.updatePrescription('rx-1', {
      updateMedications: [
        {
          prescriptionMedicationId: 'med-1',
          updatePhases: [
            {
              phaseId: 'phase-1',
              manualAdjustmentEnabled: true,
              manualTimes: ['09:00'],
            },
          ],
        },
      ],
    } as never);

    const phase = (
      state.prescription.medications as Array<{ phases: Array<{ id: string; phaseOrder: number; manualAdjustmentEnabled: boolean; manualTimes?: string[] }> }>
    )[0].phases.find((item) => item.id === 'phase-1');
    expect(phase?.phaseOrder).toBe(1);
    expect(phase?.manualAdjustmentEnabled).toBe(true);
    expect(phase?.manualTimes).toEqual(['09:00']);
  });

  it('replaces all phases of a medication', async () => {
    const { service, state } = createUpdateServiceHarness();

    await service.updatePrescription('rx-1', {
      updateMedications: [
        {
          prescriptionMedicationId: 'med-1',
          replacePhases: [buildUpsertPhase(), buildUpsertPhase({ treatmentDays: 5 })],
        },
      ],
    } as never);

    const phases = (
      state.prescription.medications as Array<{ id: string; phases: Array<{ phaseOrder: number }> }>
    )[0].phases;
    expect(phases).toHaveLength(2);
    expect(phases.map((phase) => phase.phaseOrder)).toEqual([1, 2]);
  });

  it('supports add and remove medications in a single update', async () => {
    const { service, state, schedulingService } = createUpdateServiceHarness();

    const result = await service.updatePrescription('rx-1', {
      addMedications: [
        {
          clinicalMedicationId: 'clinical-2',
          protocolId: 'protocol-2',
          phases: [buildUpsertPhase()],
        },
      ],
      removeMedicationIds: ['med-1'],
    } as never);

    const medications = state.prescription.medications as Array<{ sourceClinicalMedicationId: string }>;
    expect(medications).toHaveLength(1);
    expect(medications[0].sourceClinicalMedicationId).toBe('clinical-2');
    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ prescriptionId: 'rx-1', medicationCount: 1 });
  });

  it('renumbers phaseOrder after removePhaseIds', async () => {
    const { service, state } = createUpdateServiceHarness({
      medications: [
        {
          ...(buildPrescriptionState().medications[0] as Record<string, unknown>),
          phases: [
            { id: 'phase-1', phaseOrder: 1, ...buildUpsertPhase() },
            { id: 'phase-2', phaseOrder: 2, ...buildUpsertPhase({ treatmentDays: 5 }) },
          ],
        },
      ],
    });

    await service.updatePrescription('rx-1', {
      updateMedications: [
        {
          prescriptionMedicationId: 'med-1',
          removePhaseIds: ['phase-1'],
        },
      ],
    } as never);

    const phases = (
      state.prescription.medications as Array<{ id: string; phases: Array<{ id: string; phaseOrder: number }> }>
    )[0].phases;
    expect(phases).toHaveLength(1);
    expect(phases[0].id).toBe('phase-2');
    expect(phases[0].phaseOrder).toBe(1);
  });

  it('rejects unknown prescriptionMedicationId in update', async () => {
    const { service } = createUpdateServiceHarness();

    await expect(
      service.updatePrescription('rx-1', {
        updateMedications: [
          {
            prescriptionMedicationId: 'med-inexistente',
            removePhaseIds: ['phase-1'],
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects unknown phaseId in updatePhases', async () => {
    const { service } = createUpdateServiceHarness();

    await expect(
      service.updatePrescription('rx-1', {
        updateMedications: [
          {
            prescriptionMedicationId: 'med-1',
            updatePhases: [
              {
                phaseId: 'phase-inexistente',
                treatmentDays: 20,
              },
            ],
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects duplicate clinicalMedicationId + protocolId after update', async () => {
    const { service } = createUpdateServiceHarness();

    await expect(
      service.updatePrescription('rx-1', {
        addMedications: [
          {
            clinicalMedicationId: 'clinical-1',
            protocolId: 'protocol-1',
            phases: [buildUpsertPhase()],
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects replacePhases combined with updatePhases/removePhaseIds', async () => {
    const { service } = createUpdateServiceHarness();

    await expect(
      service.updatePrescription('rx-1', {
        updateMedications: [
          {
            prescriptionMedicationId: 'med-1',
            replacePhases: [buildUpsertPhase()],
            updatePhases: [
              {
                phaseId: 'phase-1',
                treatmentDays: 20,
              },
            ],
          },
        ],
      } as never),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('reconstructs perDoseOverrides from relational phase doses on findById', async () => {
    const { service, repository } = createService();

    repository.findOne.mockResolvedValue({
      id: 'rx-1',
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'med-1',
          phases: [
            Object.assign(new PatientPrescriptionPhase(), {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 2,
              sameDosePerSchedule: false,
              doseOverrides: [
                { id: 'dose-2', doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
                { id: 'dose-1', doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
              ],
            }),
          ],
        },
      ],
    });

    const prescription = await service.findById('rx-1');
    const phase = prescription.medications[0].phases[0];

    expect(phase.perDoseOverrides).toEqual([
      { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
      { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
    ]);
  });

  it('persists variable dose phases through the relational phase dose repository', async () => {
    const { service, prescriptionRepository, clinicalCatalogService, phaseDoseRepository } =
      createService();

    clinicalCatalogService.findMedicationById.mockResolvedValue(
      buildClinicalMedicationWithProtocol({
        frequencies: [
          {
            frequency: 2,
            allowsVariableDoseBySchedule: true,
            steps: [
              {
                doseLabel: 'D1',
                anchor: ClinicalAnchor.CAFE,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
              {
                doseLabel: 'D2',
                anchor: ClinicalAnchor.JANTAR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
            ],
          },
        ],
      }),
    );
    prescriptionRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      patient: { id: 'patient-1' },
      medications: [
        {
          id: 'prescription-medication-1',
          sourceClinicalMedicationId: 'clinical-1',
          sourceProtocolId: 'protocol-1',
          medicationSnapshot: {
            id: 'clinical-1',
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescricao.',
          },
          protocolSnapshot: {
            id: 'protocol-1',
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I',
            description: 'Protocolo base',
            groupCode: GroupCode.GROUP_I,
            priority: 0,
            isDefault: true,
            frequencies: [
              {
                frequency: 2,
                allowsVariableDoseBySchedule: true,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.STANDARD,
                  },
                ],
              },
            ],
          },
          interactionRulesSnapshot: [],
          phases: [
            Object.assign(new PatientPrescriptionPhase(), {
              id: 'phase-1',
              phaseOrder: 1,
              frequency: 2,
              sameDosePerSchedule: false,
              doseOverrides: [
                { id: 'dose-1', doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
                { id: 'dose-2', doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
              ],
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            }),
          ],
        },
      ],
    }));

    await service.create({
      patientId: 'patient-1',
      startedAt: '2026-04-21',
      medications: [
        {
          clinicalMedicationId: 'clinical-1',
          protocolId: 'protocol-1',
          phases: [
            {
              phaseOrder: 1,
              frequency: 2,
              sameDosePerSchedule: false,
              perDoseOverrides: [
                { doseLabel: 'D1', doseValue: '1', doseUnit: DoseUnit.COMP },
                { doseLabel: 'D2', doseValue: '2', doseUnit: DoseUnit.COMP },
              ],
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 10,
              continuousUse: false,
              manualAdjustmentEnabled: false,
            } as never,
          ],
        },
      ],
    });

    expect(phaseDoseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        doseLabel: 'D1',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
      }),
    );
    expect(phaseDoseRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        doseLabel: 'D2',
        doseValue: '2',
        doseUnit: DoseUnit.COMP,
      }),
    );
  });
});
