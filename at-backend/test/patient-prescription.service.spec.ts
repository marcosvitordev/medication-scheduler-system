import 'reflect-metadata';
import { UnprocessableEntityException } from '@nestjs/common';
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
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        const entityName = typeof entity === 'function' ? entity.name : String(entity);
        if (entityName === 'PatientPrescription') return prescriptionRepository;
        if (entityName === 'PatientPrescriptionMedication') return medicationRepository;
        if (entityName === 'PatientPrescriptionPhase') return phaseRepository;
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
      monthlySpecialOffsetDays: 8,
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
                monthlySpecialOffsetDays: 8,
                monthlyDay: undefined,
              }),
            ],
          },
        ],
      }),
    ).resolves.toBeDefined();

    expect(schedulingService.buildAndPersistSchedule).toHaveBeenCalled();
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
});
