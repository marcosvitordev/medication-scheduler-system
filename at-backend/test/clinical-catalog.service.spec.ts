import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import { ClinicalCatalogService } from '../src/modules/clinical-catalog/clinical-catalog.service';

describe('ClinicalCatalogService', () => {
  function createService() {
    const medicationRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    const groupRepository = {
      create: jest.fn((entity) => entity),
      save: jest.fn(async (entity) => entity),
      find: jest.fn().mockResolvedValue([]),
    };

    return {
      service: new ClinicalCatalogService(
        medicationRepository as never,
        groupRepository as never,
      ),
      medicationRepository,
      groupRepository,
    };
  }

  it('creates a clinical medication with protocols, frequencies and interaction rules', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    groupRepository.find.mockResolvedValue([
      { id: 'group-i', code: GroupCode.GROUP_I, name: 'Grupo I' },
    ]);

    const result = await service.createMedication({
      commercialName: 'LOSARTANA',
      activePrinciple: 'Losartana potassica',
      presentation: 'Comprimido revestido',
      administrationRoute: 'VO',
      usageInstructions: 'Conforme prescricao.',
      protocols: [
        {
          code: 'GROUP_I_STANDARD',
          name: 'Grupo I padrao',
          description: 'Protocolo simples.',
          groupCode: GroupCode.GROUP_I,
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                },
              ],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
              priority: 1,
            },
          ],
        },
      ],
    });

    expect(medicationRepository.create).toHaveBeenCalled();
    expect(medicationRepository.save).toHaveBeenCalled();
    expect(result).toMatchObject({
      commercialName: 'LOSARTANA',
      protocols: [
        {
          code: 'GROUP_I_STANDARD',
          group: { code: GroupCode.GROUP_I },
          frequencies: [
            {
              frequency: 1,
              steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }],
            },
          ],
          interactionRules: [
            {
              interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
              targetGroupCode: GroupCode.GROUP_III_SAL,
              resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            },
          ],
        },
      ],
    });
  });

  it('rejects protocol creation when the referenced clinical group does not exist', async () => {
    const { service, groupRepository } = createService();
    groupRepository.find.mockResolvedValue([]);

    await expect(
      service.createMedication({
        activePrinciple: 'Teste',
        presentation: 'Caixa',
        administrationRoute: 'VO',
        usageInstructions: 'Conforme prescricao.',
        protocols: [
          {
            code: 'PROTO',
            name: 'Protocolo',
            description: 'Descricao',
            groupCode: GroupCode.GROUP_I,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seeds the default clinical groups without depending on the legacy module', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    const allGroups = [
      GroupCode.GROUP_I,
      GroupCode.GROUP_I_SIME,
      GroupCode.GROUP_II,
      GroupCode.GROUP_II_BIFOS,
      GroupCode.GROUP_II_SUCRA,
      GroupCode.GROUP_III,
      GroupCode.GROUP_III_LAX,
      GroupCode.GROUP_III_MET,
      GroupCode.GROUP_III_ESTAT,
      GroupCode.GROUP_III_DIU,
      GroupCode.GROUP_III_SUL,
      GroupCode.GROUP_III_SUL2,
      GroupCode.GROUP_III_PROC,
      GroupCode.GROUP_III_SAL,
      GroupCode.GROUP_III_CALC,
      GroupCode.GROUP_III_FER,
      GroupCode.GROUP_I_SED,
      GroupCode.GROUP_INSUL_ULTRA,
      GroupCode.GROUP_INSUL_RAPIDA,
      GroupCode.GROUP_INSUL_INTER,
      GroupCode.GROUP_INSUL_LONGA,
      GroupCode.GROUP_DELTA,
    ].map((code) => ({ id: `${code}-id`, code }));

    groupRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(allGroups);
    medicationRepository.find.mockResolvedValue([]);

    await service.seedCatalog();

    expect(groupRepository.save).toHaveBeenCalled();
    expect(medicationRepository.save).toHaveBeenCalled();
    const savedGroups = groupRepository.save.mock.calls[0][0];
    expect(Array.isArray(savedGroups)).toBe(true);
    expect(savedGroups.length).toBeGreaterThan(0);
      expect(savedGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: GroupCode.GROUP_I }),
        expect.objectContaining({ code: GroupCode.GROUP_I_SIME }),
        expect.objectContaining({ code: GroupCode.GROUP_II }),
        expect.objectContaining({ code: GroupCode.GROUP_III_LAX }),
        expect.objectContaining({ code: GroupCode.GROUP_III_ESTAT }),
        expect.objectContaining({ code: GroupCode.GROUP_III_DIU }),
        expect.objectContaining({ code: GroupCode.GROUP_III_SUL }),
        expect.objectContaining({ code: GroupCode.GROUP_III_SUL2 }),
        expect.objectContaining({ code: GroupCode.GROUP_III_PROC }),
        expect.objectContaining({ code: GroupCode.GROUP_III_SAL }),
        expect.objectContaining({ code: GroupCode.GROUP_III_FER }),
        expect.objectContaining({ code: GroupCode.GROUP_INSUL_ULTRA }),
        expect.objectContaining({ code: GroupCode.GROUP_INSUL_INTER }),
        expect.objectContaining({ code: GroupCode.GROUP_INSUL_LONGA }),
        expect.objectContaining({ code: GroupCode.GROUP_DELTA }),
      ]),
    );

    const savedMedicationCalls = medicationRepository.save.mock.calls;
    const flattenedSavedMedications = savedMedicationCalls.flatMap((call) =>
      Array.isArray(call[0]) ? call[0] : [call[0]],
    );

    expect(flattenedSavedMedications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commercialName: 'LOSARTANA',
          protocols: expect.arrayContaining([
            expect.objectContaining({
              code: 'GROUP_I_STANDARD',
              frequencies: expect.arrayContaining([
                expect.objectContaining({ frequency: 1 }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'DORALGINA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_I_DORALGINA_6H' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'SIMETICONA',
          protocols: expect.arrayContaining([
            expect.objectContaining({
              code: 'GROUP_I_SIME_STANDARD',
              frequencies: expect.arrayContaining([
                expect.objectContaining({ frequency: 1 }),
                expect.objectContaining({ frequency: 2 }),
                expect.objectContaining({ frequency: 3 }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'MEDICAMENTO GRUPO II',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_II_WAKE' }),
            expect.objectContaining({ code: 'GROUP_II_BEDTIME' }),
            expect.objectContaining({ code: 'GROUP_II_LUNCH_BEFORE' }),
            expect.objectContaining({ code: 'GROUP_II_LUNCH_AFTER' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'MEDICAMENTO GRUPO III',
          protocols: expect.arrayContaining([
            expect.objectContaining({
              code: 'GROUP_III_CAFE_STANDARD',
              isDefault: true,
            }),
            expect.objectContaining({
              code: 'GROUP_III_ALMOCO_STANDARD',
              isDefault: false,
            }),
            expect.objectContaining({
              code: 'GROUP_III_JANTAR_STANDARD',
              isDefault: false,
            }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'CONTRAVE',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_CONTRAVE' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'BISACODIL',
          protocols: expect.arrayContaining([
            expect.objectContaining({
              code: 'GROUP_III_LAX_STANDARD',
              frequencies: expect.arrayContaining([
                expect.objectContaining({ frequency: 1 }),
                expect.objectContaining({ frequency: 2 }),
              ]),
            }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'FUROSEMIDA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_DIU_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'GLICLAZIDA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_SUL_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'GLIBENCLAMIDA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_SUL2_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'DOMPERIDONA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_PROC_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'NORIPURUM',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_III_FER_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'NOVORAPID',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_INSUL_ULTRA_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'GANSULIN R',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_INSUL_RAPIDA_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'INSULINA NPH',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_INSUL_INTER_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'LANTUS',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'GROUP_INSUL_LONGA_STANDARD' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'PERLUTAN',
          isContraceptiveMonthly: true,
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_PERLUTAN_MONTHLY' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'METRONIDAZOL',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_METRONIDAZOL_VAGINAL' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'CETOCONAZOL',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_TOPICO_APOS_BANHO' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'XALACOM',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_OCULAR_BEDTIME' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'OTOCIRIAX',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_OTICO_12H' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'BUDESONIDA NASAL',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_INTRANASAL_WAKE' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'SUPOSITORIO DE GLICERINA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_RETAL_BEDTIME' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'NITROGLICERINA',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_SUBLINGUAL_WAKE' }),
          ]),
        }),
        expect.objectContaining({
          commercialName: 'SALBUTAMOL',
          protocols: expect.arrayContaining([
            expect.objectContaining({ code: 'DELTA_INALATORIO_12H' }),
          ]),
        }),
      ]),
    );
  });

  it('seeds every documented default protocol family with its expected frequencies', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    const allGroups = Object.values(GroupCode).map((code) => ({ id: `${code}-id`, code }));

    groupRepository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(allGroups);
    medicationRepository.find.mockResolvedValue([]);

    await service.seedCatalog();

    const flattenedSavedMedications = medicationRepository.save.mock.calls.flatMap((call) =>
      Array.isArray(call[0]) ? call[0] : [call[0]],
    );
    const protocols = flattenedSavedMedications.flatMap((medication) => medication.protocols ?? []);
    const protocolsByCode = new Map(protocols.map((protocol) => [protocol.code, protocol]));

    const groupIProtocol = protocolsByCode.get('GROUP_I_STANDARD');
    expect(groupIProtocol?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3, 4]);
    const groupIFrequency4 = groupIProtocol?.frequencies.find((frequency) => frequency.frequency === 4);
    expect(groupIFrequency4).toMatchObject({
      frequency: 4,
      label: '4x ao dia / 6/6h',
      allowedRecurrenceTypes: [
        TreatmentRecurrence.DAILY,
        TreatmentRecurrence.PRN,
      ],
      allowsPrn: true,
    });
    expect(groupIFrequency4?.steps).toEqual([
      expect.objectContaining({
        doseLabel: 'D1',
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: 0,
      }),
      expect.objectContaining({
        doseLabel: 'D2',
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: 360,
      }),
      expect.objectContaining({
        doseLabel: 'D3',
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: 720,
      }),
      expect.objectContaining({
        doseLabel: 'D4',
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: 1080,
      }),
    ]);
    const doralginaFrequency = protocolsByCode.get('GROUP_I_DORALGINA_6H')?.frequencies[0];
    expect(doralginaFrequency).toMatchObject({
      frequency: 4,
      label: '4x ao dia / 6/6h',
      allowedRecurrenceTypes: [
        TreatmentRecurrence.DAILY,
        TreatmentRecurrence.PRN,
      ],
      allowsPrn: true,
    });
    expect(doralginaFrequency?.steps.map((step) => step.offsetMinutes)).toEqual([
      0,
      360,
      720,
      1080,
    ]);
    expect(protocolsByCode.get('GROUP_II_WAKE')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    const bifosFrequency = protocolsByCode.get('GROUP_II_BIFOS_STANDARD')?.frequencies[0];
    expect(bifosFrequency).toMatchObject({
      frequency: 1,
      label: '1x por semana',
      allowedRecurrenceTypes: [
        TreatmentRecurrence.DAILY,
        TreatmentRecurrence.WEEKLY,
      ],
    });
    expect(bifosFrequency?.steps).toEqual([
      expect.objectContaining({
        doseLabel: 'D1',
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: -60,
      }),
    ]);
    expect(protocolsByCode.get('GROUP_I_SIME_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    expect(protocolsByCode.get('GROUP_II_BEDTIME')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('GROUP_II_LUNCH_BEFORE')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('GROUP_II_LUNCH_AFTER')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    const groupIIICafeProtocol = protocolsByCode.get('GROUP_III_CAFE_STANDARD');
    expect(groupIIICafeProtocol).toMatchObject({
      group: expect.objectContaining({ code: GroupCode.GROUP_III }),
      isDefault: true,
      description: expect.stringContaining('3 tomadas no café, almoço e jantar'),
    });
    expect(groupIIICafeProtocol?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    expect(groupIIICafeProtocol?.frequencies.find((frequency) => frequency.frequency === 3)?.steps).toEqual([
      expect.objectContaining({
        doseLabel: 'D1',
        anchor: ClinicalAnchor.CAFE,
        offsetMinutes: 0,
      }),
      expect.objectContaining({
        doseLabel: 'D2',
        anchor: ClinicalAnchor.ALMOCO,
        offsetMinutes: 0,
      }),
      expect.objectContaining({
        doseLabel: 'D3',
        anchor: ClinicalAnchor.JANTAR,
        offsetMinutes: 0,
      }),
    ]);
    expect(protocolsByCode.get('GROUP_III_ALMOCO_STANDARD')).toMatchObject({
      isDefault: false,
      description: expect.stringContaining('1 tomada no almoço'),
      frequencies: [
        expect.objectContaining({
          frequency: 1,
          steps: [
            expect.objectContaining({
              doseLabel: 'D1',
              anchor: ClinicalAnchor.ALMOCO,
              offsetMinutes: 0,
            }),
          ],
        }),
      ],
    });
    expect(protocolsByCode.get('GROUP_III_JANTAR_STANDARD')).toMatchObject({
      isDefault: false,
      description: expect.stringContaining('1 tomada no jantar'),
      frequencies: [
        expect.objectContaining({
          frequency: 1,
          steps: [
            expect.objectContaining({
              doseLabel: 'D1',
              anchor: ClinicalAnchor.JANTAR,
              offsetMinutes: 0,
            }),
          ],
        }),
      ],
    });
    const contraveProtocol = protocolsByCode.get('GROUP_III_CONTRAVE');
    expect(contraveProtocol?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2]);
    expect(contraveProtocol?.frequencies.find((frequency) => frequency.frequency === 2)).toMatchObject({
      allowsVariableDoseBySchedule: true,
      steps: [
        expect.objectContaining({ anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }),
        expect.objectContaining({ anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 }),
      ],
    });
    expect(protocolsByCode.get('GROUP_III_LAX_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2]);
    expect(protocolsByCode.get('GROUP_III_ESTAT_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('GROUP_III_DIU_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2]);
    expect(protocolsByCode.get('GROUP_III_SUL_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    expect(protocolsByCode.get('GROUP_III_SUL2_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    expect(protocolsByCode.get('GROUP_III_PROC_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3]);
    expect(protocolsByCode.get('GROUP_III_FER_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('GROUP_INSUL_ULTRA_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3, 4]);
    expect(protocolsByCode.get('GROUP_INSUL_RAPIDA_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2, 3, 4]);
    expect(protocolsByCode.get('GROUP_INSUL_INTER_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1, 2]);
    expect(protocolsByCode.get('GROUP_INSUL_LONGA_STANDARD')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_PERLUTAN_MONTHLY')?.frequencies[0]).toMatchObject({
      frequency: 1,
      label: '1x ao mês',
      allowedRecurrenceTypes: [TreatmentRecurrence.MONTHLY],
      steps: [
        expect.objectContaining({ anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0 }),
      ],
    });
    expect(protocolsByCode.get('DELTA_OCULAR_BEDTIME')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_OTICO_12H')?.frequencies.map((frequency) => frequency.frequency)).toEqual([2]);
    expect(protocolsByCode.get('DELTA_METRONIDAZOL_VAGINAL')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_TOPICO_APOS_BANHO')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_INTRANASAL_WAKE')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_RETAL_BEDTIME')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_SUBLINGUAL_WAKE')?.frequencies.map((frequency) => frequency.frequency)).toEqual([1]);
    expect(protocolsByCode.get('DELTA_INALATORIO_12H')?.frequencies.map((frequency) => frequency.frequency)).toEqual([2]);
    expect(
      protocolsByCode
        .get('DELTA_TOPICO_APOS_BANHO')
        ?.frequencies[0]?.steps.map((step) => step.anchor),
    ).toEqual([ClinicalAnchor.APOS_BANHO]);
  });

  it('updates existing seeded medications and protocols without removing custom protocols', async () => {
    const { service, groupRepository, medicationRepository } = createService();
    const allGroups = Object.values(GroupCode).map((code) => ({ id: `${code}-id`, code }));
    const buildProtocol = (
      code: string,
      groupCode: GroupCode,
      frequencies: Array<Record<string, unknown>> = [
        {
          frequency: 1,
          allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
          steps: [
            {
              doseLabel: 'D1',
              anchor: ClinicalAnchor.CAFE,
              offsetMinutes: 0,
            },
          ],
        },
      ],
    ) => ({
      id: `${code}-id`,
      code,
      name: `${code} antigo`,
      description: 'Versão antiga do seed.',
      priority: 99,
      isDefault: false,
      active: true,
      group: { code: groupCode },
      frequencies,
      interactionRules: [],
    });

    const existingMedications = [
      {
        id: 'alendronato-id',
        commercialName: 'ALENDRONATO',
        activePrinciple: 'Alendronato de sodio',
        presentation: 'Apresentação antiga',
        administrationRoute: 'VO',
        usageInstructions: 'Uso antigo.',
        isOphthalmic: false,
        isOtic: false,
        isContraceptiveMonthly: false,
        requiresGlycemiaScale: false,
        supportsManualAdjustment: false,
        protocols: [
          buildProtocol('GROUP_II_BIFOS_STANDARD', GroupCode.GROUP_II_BIFOS),
          buildProtocol('CUSTOM_FASTING_PROTOCOL', GroupCode.GROUP_II_BIFOS),
        ],
      },
      {
        id: 'losartana-id',
        commercialName: 'LOSARTANA',
        activePrinciple: 'Losartana potassica',
        presentation: 'Comprimido revestido',
        administrationRoute: 'VO',
        usageInstructions: 'Conforme prescricao.',
        protocols: [
          buildProtocol('GROUP_I_STANDARD', GroupCode.GROUP_I, [
            { frequency: 1, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }] },
            { frequency: 2, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }] },
            { frequency: 3, steps: [{ doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 }] },
          ]),
        ],
      },
      {
        id: 'xalacom-id',
        commercialName: 'XALACOM',
        activePrinciple: 'Latanoprosta + Timolol',
        presentation: 'Frasco 2,5 ml',
        administrationRoute: 'OCULAR',
        usageInstructions: 'Uso antigo.',
        isOphthalmic: false,
        isOtic: false,
        protocols: [buildProtocol('DELTA_OCULAR_BEDTIME', GroupCode.GROUP_DELTA)],
      },
      {
        id: 'otociriax-id',
        commercialName: 'OTOCIRIAX',
        activePrinciple: 'Ciprofloxacino + Hidrocortisona',
        presentation: 'Frasco 5 ml',
        administrationRoute: 'OTOLÓGICA',
        usageInstructions: 'Uso antigo.',
        isOphthalmic: false,
        isOtic: false,
        protocols: [buildProtocol('DELTA_OTICO_12H', GroupCode.GROUP_DELTA)],
      },
      {
        id: 'perlutan-id',
        commercialName: 'PERLUTAN',
        activePrinciple: 'Algestona acetofenida + Enantato de estradiol',
        presentation: 'Ampola 1 ml',
        administrationRoute: 'IM',
        usageInstructions: 'Uso antigo.',
        isContraceptiveMonthly: false,
        protocols: [buildProtocol('DELTA_PERLUTAN_MONTHLY', GroupCode.GROUP_DELTA)],
      },
    ];

    groupRepository.find.mockResolvedValue(allGroups);
    medicationRepository.find.mockResolvedValue(existingMedications);

    await service.seedCatalog();

    const savedExistingMedications = medicationRepository.save.mock.calls
      .map((call) => call[0])
      .filter((saved) => !Array.isArray(saved) && saved.id);
    const savedById = new Map(
      savedExistingMedications.map((medication) => [medication.id, medication]),
    );

    const alendronato = savedById.get('alendronato-id');
    const bifosProtocol = alendronato.protocols.find(
      (protocol) => protocol.code === 'GROUP_II_BIFOS_STANDARD',
    );
    expect(alendronato.protocols.map((protocol) => protocol.code)).toContain(
      'CUSTOM_FASTING_PROTOCOL',
    );
    expect(bifosProtocol.frequencies).toHaveLength(1);
    expect(bifosProtocol.frequencies[0]).toMatchObject({
      frequency: 1,
      label: '1x por semana',
      allowedRecurrenceTypes: [
        TreatmentRecurrence.DAILY,
        TreatmentRecurrence.WEEKLY,
      ],
    });
    expect(bifosProtocol.frequencies[0].steps).toEqual([
      expect.objectContaining({
        anchor: ClinicalAnchor.ACORDAR,
        offsetMinutes: -60,
      }),
    ]);

    const groupIProtocol = savedById
      .get('losartana-id')
      .protocols.find((protocol) => protocol.code === 'GROUP_I_STANDARD');
    expect(groupIProtocol.frequencies.map((frequency) => frequency.frequency)).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(
      groupIProtocol.frequencies.find((frequency) => frequency.frequency === 4),
    ).toMatchObject({
      allowedRecurrenceTypes: [
        TreatmentRecurrence.DAILY,
        TreatmentRecurrence.PRN,
      ],
      allowsPrn: true,
    });

    expect(savedById.get('xalacom-id')).toMatchObject({ isOphthalmic: true });
    expect(savedById.get('otociriax-id')).toMatchObject({ isOtic: true });
    expect(savedById.get('perlutan-id')).toMatchObject({
      isContraceptiveMonthly: true,
    });
    expect(
      savedById
        .get('perlutan-id')
        .protocols.find((protocol) => protocol.code === 'DELTA_PERLUTAN_MONTHLY')
        .frequencies[0],
    ).toMatchObject({
      allowedRecurrenceTypes: [TreatmentRecurrence.MONTHLY],
    });
  });
});
