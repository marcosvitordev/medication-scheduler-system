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
});
