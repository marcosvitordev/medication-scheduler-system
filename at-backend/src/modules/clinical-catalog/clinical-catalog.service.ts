import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicalAnchor } from '../../common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../common/enums/clinical-semantic-tag.enum';
import { GroupCode } from '../../common/enums/group-code.enum';
import { TreatmentRecurrence } from '../../common/enums/treatment-recurrence.enum';
import {
  CreateClinicalMedicationDto,
  CreateClinicalProtocolDto,
} from './dto/create-clinical-medication.dto';
import { ClinicalGroup } from './entities/clinical-group.entity';
import { ClinicalInteractionRule } from './entities/clinical-interaction-rule.entity';
import { ClinicalMedication } from './entities/clinical-medication.entity';
import { ClinicalProtocolFrequency } from './entities/clinical-protocol-frequency.entity';
import { ClinicalProtocol } from './entities/clinical-protocol.entity';
import { ClinicalProtocolStep } from './entities/clinical-protocol-step.entity';

@Injectable()
export class ClinicalCatalogService {
  constructor(
    @InjectRepository(ClinicalMedication)
    private readonly clinicalMedicationRepository: Repository<ClinicalMedication>,
    @InjectRepository(ClinicalGroup)
    private readonly clinicalGroupRepository: Repository<ClinicalGroup>,
  ) {}

  async createMedication(dto: CreateClinicalMedicationDto): Promise<ClinicalMedication> {
    const groups = await this.clinicalGroupRepository.find();
    const groupsByCode = new Map(groups.map((group) => [group.code, group]));

    const medication = this.clinicalMedicationRepository.create({
      commercialName: dto.commercialName,
      activePrinciple: dto.activePrinciple,
      presentation: dto.presentation,
      pharmaceuticalForm: dto.pharmaceuticalForm,
      administrationRoute: dto.administrationRoute,
      usageInstructions: dto.usageInstructions,
      diluentType: dto.diluentType,
      defaultAdministrationUnit: dto.defaultAdministrationUnit,
      supportsManualAdjustment: dto.supportsManualAdjustment ?? false,
      isOphthalmic: dto.isOphthalmic ?? false,
      isOtic: dto.isOtic ?? false,
      isContraceptiveMonthly: dto.isContraceptiveMonthly ?? false,
      requiresGlycemiaScale: dto.requiresGlycemiaScale ?? false,
      notes: dto.notes,
      isDefault: dto.isDefault ?? false,
      protocols: dto.protocols.map((protocolDto) =>
        this.buildProtocol(protocolDto, groupsByCode),
      ),
    });

    return this.clinicalMedicationRepository.save(medication);
  }

  async listMedications(): Promise<ClinicalMedication[]> {
    return this.clinicalMedicationRepository.find();
  }

  async listGroups(): Promise<ClinicalGroup[]> {
    return this.clinicalGroupRepository.find({ order: { code: 'ASC' } });
  }

  async findMedicationById(id: string): Promise<ClinicalMedication> {
    const medication = await this.clinicalMedicationRepository.findOne({
      where: { id },
    });
    if (!medication) {
      throw new NotFoundException('Medicamento clínico não encontrado.');
    }
    return medication;
  }

  async findProtocolById(protocolId: string): Promise<ClinicalProtocol> {
    const medication = await this.clinicalMedicationRepository.find();
    for (const currentMedication of medication) {
      const protocol = currentMedication.protocols.find((item) => item.id === protocolId);
      if (protocol) return protocol;
    }
    throw new NotFoundException('Protocolo clínico não encontrado.');
  }

  async seedCatalog(): Promise<ClinicalGroup[]> {
    const defaults = [
      {
        code: GroupCode.GROUP_I,
        name: 'Grupo I',
        description: 'Medicamentos independentes das refeições.',
      },
      {
        code: GroupCode.GROUP_II,
        name: 'Grupo II',
        description: 'Medicamentos em jejum ou em horários específicos pré-refeição.',
      },
      {
        code: GroupCode.GROUP_II_BIFOS,
        name: 'Grupo II - Bifosfonatos',
        description: 'Acordar 1 hora mais cedo.',
      },
      {
        code: GroupCode.GROUP_II_SUCRA,
        name: 'Grupo II - Sucralfato',
        description: 'Regra especial de deslocamento e inativação.',
      },
      {
        code: GroupCode.GROUP_III,
        name: 'Grupo III',
        description: 'Medicamentos relacionados às refeições.',
      },
      {
        code: GroupCode.GROUP_III_LAX,
        name: 'Grupo III - Lax',
        description: 'Laxativos pós-refeição e ao dormir.',
      },
      {
        code: GroupCode.GROUP_III_MET,
        name: 'Grupo III - Met',
        description: 'Medicamento junto às refeições principais.',
      },
      {
        code: GroupCode.GROUP_III_ESTAT,
        name: 'Grupo III - Estat',
        description: 'Estatinas ao jantar.',
      },
      {
        code: GroupCode.GROUP_III_DIU,
        name: 'Grupo III - Diu',
        description: 'Diuréticos alinhados a café e lanche.',
      },
      {
        code: GroupCode.GROUP_III_SUL,
        name: 'Grupo III - Sul',
        description: 'Sulfonilureias nas refeições principais.',
      },
      {
        code: GroupCode.GROUP_III_SUL2,
        name: 'Grupo III - Sul 2',
        description: 'Sulfonilureias 30 minutos antes das refeições.',
      },
      {
        code: GroupCode.GROUP_III_PROC,
        name: 'Grupo III - Proc',
        description: 'Procinéticos 20 minutos antes das refeições.',
      },
      {
        code: GroupCode.GROUP_III_SAL,
        name: 'Grupo III - Sal',
        description: 'Sais com inativação por conflito.',
      },
      {
        code: GroupCode.GROUP_III_CALC,
        name: 'Grupo III - Calc',
        description: 'Cálcio com possível deslocamento de 1 hora.',
      },
      {
        code: GroupCode.GROUP_III_FER,
        name: 'Grupo III - Fer',
        description: 'Ferro 30 minutos antes do almoço.',
      },
      {
        code: GroupCode.GROUP_I_SED,
        name: 'Grupo I - Sed',
        description: '20 minutos antes de dormir.',
      },
      {
        code: GroupCode.GROUP_INSUL_ULTRA,
        name: 'Grupo Insul - Ultra',
        description: 'Insulina subcutânea ultra-rápida.',
      },
      {
        code: GroupCode.GROUP_INSUL_RAPIDA,
        name: 'Grupo Insul - Rápida',
        description: 'Insulina subcutânea rápida.',
      },
      {
        code: GroupCode.GROUP_INSUL_INTER,
        name: 'Grupo Insul - Inter',
        description: 'Insulina subcutânea intermediária.',
      },
      {
        code: GroupCode.GROUP_INSUL_LONGA,
        name: 'Grupo Insul - Longa',
        description: 'Insulina subcutânea de longa ação.',
      },
      {
        code: GroupCode.GROUP_DELTA,
        name: 'Grupo Delta',
        description: 'Protocolos não orais.',
      },
    ];

    const existing = (await this.clinicalGroupRepository.find()) ?? [];
    const existingCodes = new Set(existing.map((group) => group.code));
    const missing = defaults.filter((group) => !existingCodes.has(group.code));
    if (missing.length > 0) {
      await this.clinicalGroupRepository.save(
        missing.map((group) => this.clinicalGroupRepository.create(group)),
      );
    }

    const groups = await this.listGroups();
    const groupsByCode = new Map(groups.map((group) => [group.code, group]));
    await this.seedDefaultClinicalMedications(groupsByCode);
    return groups;
  }

  private async seedDefaultClinicalMedications(
    groupsByCode: Map<string, ClinicalGroup>,
  ): Promise<void> {
    const seedMedications = this.defaultMedicationSeedData();
    const existingMedications = (await this.clinicalMedicationRepository.find()) ?? [];
    const medicationByKey = new Map(
      existingMedications.map((medication) => [
        this.buildMedicationSeedKey(
          medication.commercialName,
          medication.activePrinciple,
        ),
        medication,
      ]),
    );
    const existingProtocolCodes = new Set(
      existingMedications.flatMap((medication) =>
        (medication.protocols ?? []).map((protocol) => protocol.code),
      ),
    );

    for (const seedMedication of seedMedications) {
      const protocolsToCreate = seedMedication.protocols.filter(
        (protocol) => !existingProtocolCodes.has(protocol.code),
      );
      if (protocolsToCreate.length === 0) {
        continue;
      }

      const medicationKey = this.buildMedicationSeedKey(
        seedMedication.commercialName,
        seedMedication.activePrinciple,
      );
      const existingMedication = medicationByKey.get(medicationKey);

      if (existingMedication) {
        existingMedication.protocols = [
          ...(existingMedication.protocols ?? []),
          ...protocolsToCreate.map((protocolDto) =>
            this.buildProtocol(protocolDto, groupsByCode),
          ),
        ];
        await this.clinicalMedicationRepository.save(existingMedication);
      } else {
        const medication = this.clinicalMedicationRepository.create({
          commercialName: seedMedication.commercialName,
          activePrinciple: seedMedication.activePrinciple,
          presentation: seedMedication.presentation,
          pharmaceuticalForm: seedMedication.pharmaceuticalForm,
          administrationRoute: seedMedication.administrationRoute,
          usageInstructions: seedMedication.usageInstructions,
          diluentType: seedMedication.diluentType,
          defaultAdministrationUnit: seedMedication.defaultAdministrationUnit,
          supportsManualAdjustment: seedMedication.supportsManualAdjustment ?? false,
          isOphthalmic: seedMedication.isOphthalmic ?? false,
          isOtic: seedMedication.isOtic ?? false,
          isContraceptiveMonthly: seedMedication.isContraceptiveMonthly ?? false,
          requiresGlycemiaScale: seedMedication.requiresGlycemiaScale ?? false,
          notes: seedMedication.notes,
          isDefault: seedMedication.isDefault ?? false,
          protocols: protocolsToCreate.map((protocolDto) =>
            this.buildProtocol(protocolDto, groupsByCode),
          ),
        });
        const saved = await this.clinicalMedicationRepository.save(medication);
        medicationByKey.set(medicationKey, saved);
      }

      protocolsToCreate.forEach((protocol) => existingProtocolCodes.add(protocol.code));
    }
  }

  private buildMedicationSeedKey(
    commercialName: string | undefined,
    activePrinciple: string,
  ): string {
    const normalizedCommercial = (commercialName ?? '').trim().toLowerCase();
    const normalizedPrinciple = activePrinciple.trim().toLowerCase();
    return `${normalizedCommercial}::${normalizedPrinciple}`;
  }

  private defaultMedicationSeedData(): CreateClinicalMedicationDto[] {
    return [
      {
        commercialName: 'LOSARTANA',
        activePrinciple: 'Losartana potassica',
        presentation: 'Comprimido revestido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Conforme prescricao.',
        protocols: [
          {
            code: 'GROUP_I_STANDARD',
            name: 'Grupo I padrao',
            description: 'Protocolo padrão para medicamentos independentes de refeição.',
            groupCode: GroupCode.GROUP_I,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                label: '1x ao dia',
                allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 2,
                label: '2x ao dia',
                allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 3,
                label: '3x ao dia',
                allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.LANCHE,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D3',
                    anchor: ClinicalAnchor.DORMIR,
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
                priority: 50,
              },
              {
                interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
                targetGroupCode: GroupCode.GROUP_III_CALC,
                resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
                windowMinutes: 60,
                priority: 60,
              },
              {
                interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
                targetGroupCode: GroupCode.GROUP_II_SUCRA,
                resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
                windowMinutes: 420,
                priority: 70,
                applicableSemanticTags: [ClinicalSemanticTag.STANDARD],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'ALENDRONATO',
        activePrinciple: 'Alendronato de sodio',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar em jejum com agua.',
        protocols: [
          {
            code: 'GROUP_II_BIFOS_STANDARD',
            name: 'Grupo II Bifosfonatos',
            description: 'Protocolos para bifosfonatos em jejum.',
            groupCode: GroupCode.GROUP_II_BIFOS,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                label: '1x ao dia',
                allowedRecurrenceTypes: [TreatmentRecurrence.DAILY],
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: -60,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'MEDICAMENTO GRUPO II',
        activePrinciple: 'Fármaco em jejum com famílias de fórmulas clínicas',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar em jejum conforme a família clínica selecionada.',
        protocols: [
          {
            code: 'GROUP_II_WAKE',
            name: 'Grupo II - Jejum ao acordar',
            description: 'Família clínica com início ao acordar.',
            groupCode: GroupCode.GROUP_II,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 2,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: -60,
                  },
                ],
              },
              {
                frequency: 3,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.LANCHE,
                    offsetMinutes: -60,
                  },
                  {
                    doseLabel: 'D3',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
          {
            code: 'GROUP_II_BEDTIME',
            name: 'Grupo II - Ao dormir',
            description: 'Família clínica administrada no horário de dormir.',
            groupCode: GroupCode.GROUP_II,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
          {
            code: 'GROUP_II_LUNCH_BEFORE',
            name: 'Grupo II - Almoço menos 1 hora',
            description: 'Família clínica administrada 1 hora antes do almoço.',
            groupCode: GroupCode.GROUP_II,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: -60,
                  },
                ],
              },
            ],
          },
          {
            code: 'GROUP_II_LUNCH_AFTER',
            name: 'Grupo II - Almoço mais 2 horas',
            description: 'Família clínica administrada 2 horas após o almoço.',
            groupCode: GroupCode.GROUP_II,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: 120,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'GLIFAGE',
        activePrinciple: 'Metformina',
        presentation: 'Comprimido revestido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Tomar junto das refeicoes.',
        protocols: [
          {
            code: 'GROUP_III_MET_STANDARD',
            name: 'Grupo III Met',
            description: 'Metformina em refeicoes principais.',
            groupCode: GroupCode.GROUP_III_MET,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 2,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 3,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: 0,
                  },
                  {
                    doseLabel: 'D3',
                    anchor: ClinicalAnchor.JANTAR,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'GASTROGEL',
        activePrinciple: 'Hidroxido de aluminio + Hidroxido de magnesio',
        presentation: 'Suspensao oral',
        pharmaceuticalForm: 'Suspensao',
        administrationRoute: 'VO',
        usageInstructions: 'Agite o frasco antes de usar.',
        protocols: [
          {
            code: 'GROUP_III_SAL_STANDARD',
            name: 'Grupo III Sal',
            description: 'Sais com regra de inativação por conflito.',
            groupCode: GroupCode.GROUP_III_SAL,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: 120,
                  },
                ],
              },
              {
                frequency: 2,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 120,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                  },
                ],
              },
              {
                frequency: 3,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 120,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: 120,
                  },
                  {
                    doseLabel: 'D3',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'BISACODIL',
        activePrinciple: 'Bisacodil',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar afastado das refeições conforme protocolo.',
        protocols: [
          {
            code: 'GROUP_III_LAX_STANDARD',
            name: 'Grupo III Lax',
            description: 'Laxante pós-café e ao dormir.',
            groupCode: GroupCode.GROUP_III_LAX,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 120 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 120 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'SINVASTATINA',
        activePrinciple: 'Sinvastatina',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar ao jantar.',
        protocols: [
          {
            code: 'GROUP_III_ESTAT_STANDARD',
            name: 'Grupo III Estat',
            description: 'Estatina ao jantar.',
            groupCode: GroupCode.GROUP_III_ESTAT,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'FUROSEMIDA',
        activePrinciple: 'Furosemida',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar preferencialmente pela manhã e à tarde.',
        protocols: [
          {
            code: 'GROUP_III_DIU_STANDARD',
            name: 'Grupo III Diu',
            description: 'Diurético alinhado a café e lanche.',
            groupCode: GroupCode.GROUP_III_DIU,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.LANCHE, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'GLICLAZIDA',
        activePrinciple: 'Gliclazida',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar junto das refeições principais.',
        protocols: [
          {
            code: 'GROUP_III_SUL_STANDARD',
            name: 'Grupo III Sul',
            description: 'Sulfonilureia nas refeições principais.',
            groupCode: GroupCode.GROUP_III_SUL,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
                ],
              },
              {
                frequency: 3,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: 0 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'GLIBENCLAMIDA',
        activePrinciple: 'Glibenclamida',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar 30 minutos antes das refeições.',
        protocols: [
          {
            code: 'GROUP_III_SUL2_STANDARD',
            name: 'Grupo III Sul 2',
            description: 'Sulfonilureia 30 minutos antes das refeições.',
            groupCode: GroupCode.GROUP_III_SUL2,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
                ],
              },
              {
                frequency: 3,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'DOMPERIDONA',
        activePrinciple: 'Domperidona',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar 20 minutos antes das refeições.',
        protocols: [
          {
            code: 'GROUP_III_PROC_STANDARD',
            name: 'Grupo III Proc',
            description: 'Procinético antes das refeições principais.',
            groupCode: GroupCode.GROUP_III_PROC,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -20 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -20 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -20 },
                ],
              },
              {
                frequency: 3,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -20 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -20 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -20 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'SUCRAFILM',
        activePrinciple: 'Sucralfato 200mg/ml',
        presentation: 'Suspensao oral 10 ml',
        pharmaceuticalForm: 'Suspensao',
        administrationRoute: 'VO',
        usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        protocols: [
          {
            code: 'GROUP_II_SUCRA_STANDARD',
            name: 'Grupo II Sucralfato',
            description: 'Sucralfato com dose matinal e dose de dormir.',
            groupCode: GroupCode.GROUP_II_SUCRA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: 120,
                  },
                ],
              },
              {
                frequency: 2,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ACORDAR,
                    offsetMinutes: 120,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                    semanticTag: ClinicalSemanticTag.BEDTIME_SLOT,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'CALCIO',
        activePrinciple: 'Carbonato de calcio',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Usar afastado de interacoes clinicas.',
        protocols: [
          {
            code: 'GROUP_III_CALC_STANDARD',
            name: 'Grupo III Calcio',
            description: 'Calcio com deslocamento configurável por janela.',
            groupCode: GroupCode.GROUP_III_CALC,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 180,
                  },
                ],
              },
              {
                frequency: 2,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.CAFE,
                    offsetMinutes: 180,
                  },
                  {
                    doseLabel: 'D2',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'CLONAZEPAM',
        activePrinciple: 'Clonazepam',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar 20 minutos antes de dormir.',
        protocols: [
          {
            code: 'GROUP_I_SED_STANDARD',
            name: 'Grupo I Sedativo',
            description: 'Sedativo pré-sono com semântica de dormir.',
            groupCode: GroupCode.GROUP_I_SED,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: -20,
                    semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
                  },
                ],
              },
            ],
            interactionRules: [
              {
                interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
                targetGroupCode: GroupCode.GROUP_II_SUCRA,
                resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
                windowMinutes: 20,
                priority: 100,
                applicableSemanticTags: [ClinicalSemanticTag.BEDTIME_EQUIVALENT],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'NORIPURUM',
        activePrinciple: 'Ferro',
        presentation: 'Comprimido',
        pharmaceuticalForm: 'Comprimido',
        administrationRoute: 'VO',
        usageInstructions: 'Administrar 30 minutos antes do almoço.',
        protocols: [
          {
            code: 'GROUP_III_FER_STANDARD',
            name: 'Grupo III Fer',
            description: 'Ferro antes do almoço.',
            groupCode: GroupCode.GROUP_III_FER,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'NOVORAPID',
        activePrinciple: 'Insulina Aspart',
        presentation: 'Caneta 3 ml',
        pharmaceuticalForm: 'Solução injetável',
        administrationRoute: 'SC',
        usageInstructions: 'Aplicar por via subcutânea conforme refeições.',
        requiresGlycemiaScale: true,
        protocols: [
          {
            code: 'GROUP_INSUL_ULTRA_STANDARD',
            name: 'Grupo Insul Ultra',
            description: 'Insulina ultra-rápida subcutânea.',
            groupCode: GroupCode.GROUP_INSUL_ULTRA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -10 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -10 },
                ],
              },
              {
                frequency: 3,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -10 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -10 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -10 },
                ],
              },
              {
                frequency: 4,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -10 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -10 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -10 },
                  { doseLabel: 'D4', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -10 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'GANSULIN R',
        activePrinciple: 'Insulina Humana Regular 100 UI/ml',
        presentation: 'Frasco com 100 ml',
        pharmaceuticalForm: 'Solução injetável',
        administrationRoute: 'SC',
        usageInstructions: 'Aplicar por via subcutânea 30 minutos antes das refeições.',
        requiresGlycemiaScale: true,
        protocols: [
          {
            code: 'GROUP_INSUL_RAPIDA_STANDARD',
            name: 'Grupo Insul Rápida',
            description: 'Insulina rápida subcutânea antes das refeições.',
            groupCode: GroupCode.GROUP_INSUL_RAPIDA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
                ],
              },
              {
                frequency: 3,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -30 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
                ],
              },
              {
                frequency: 4,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30 },
                  { doseLabel: 'D3', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -30 },
                  { doseLabel: 'D4', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'INSULINA NPH',
        activePrinciple: 'Insulina humana NPH',
        presentation: 'Frasco 10 ml',
        pharmaceuticalForm: 'Solução injetável',
        administrationRoute: 'SC',
        usageInstructions: 'Aplicar por via subcutânea conforme rotina.',
        protocols: [
          {
            code: 'GROUP_INSUL_INTER_STANDARD',
            name: 'Grupo Insul Inter',
            description: 'Insulina intermediária subcutânea.',
            groupCode: GroupCode.GROUP_INSUL_INTER,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                ],
              },
              {
                frequency: 2,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                  { doseLabel: 'D2', anchor: ClinicalAnchor.JANTAR, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'LANTUS',
        activePrinciple: 'Insulina Glargina 100 UI/ml',
        presentation: 'Frasco contendo 3 ml + caneta',
        pharmaceuticalForm: 'Solução injetável',
        administrationRoute: 'SC',
        usageInstructions: 'Aplicar por via subcutânea uma vez ao dia.',
        protocols: [
          {
            code: 'GROUP_INSUL_LONGA_STANDARD',
            name: 'Grupo Insul Longa',
            description: 'Insulina de longa ação subcutânea.',
            groupCode: GroupCode.GROUP_INSUL_LONGA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: 0 },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'METRONIDAZOL',
        activePrinciple: 'Metronidazol 100mg/g',
        presentation: 'Gel vaginal 50 g',
        pharmaceuticalForm: 'Gel',
        administrationRoute: 'VIA VAGINAL',
        usageInstructions: 'Introduzir aplicador profundamente antes de dormir.',
        protocols: [
          {
            code: 'DELTA_METRONIDAZOL_VAGINAL',
            name: 'Metronidazol vaginal',
            description: 'Aplicação vaginal no período de dormir.',
            groupCode: GroupCode.GROUP_DELTA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.DORMIR,
                    offsetMinutes: -20,
                    semanticTag: ClinicalSemanticTag.BEDTIME_EQUIVALENT,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        commercialName: 'CETOCONAZOL',
        activePrinciple: 'Cetoconazol 20mg/g',
        presentation: 'Creme 30 g',
        pharmaceuticalForm: 'Creme',
        administrationRoute: 'USO TOPICO',
        usageInstructions: 'Aplicar na área afetada uma vez ao dia.',
        protocols: [
          {
            code: 'DELTA_CETOCONAZOL_TOPICO',
            name: 'Cetoconazol topico',
            description: 'Uso tópico diário no almoço.',
            groupCode: GroupCode.GROUP_DELTA,
            isDefault: true,
            frequencies: [
              {
                frequency: 1,
                steps: [
                  {
                    doseLabel: 'D1',
                    anchor: ClinicalAnchor.ALMOCO,
                    offsetMinutes: 0,
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
  }

  private buildProtocol(
    dto: CreateClinicalProtocolDto,
    groupsByCode: Map<string, ClinicalGroup>,
  ): ClinicalProtocol {
    const group = groupsByCode.get(dto.groupCode);
    if (!group) {
      throw new NotFoundException(`Grupo clínico ${dto.groupCode} não encontrado.`);
    }

    const protocol = new ClinicalProtocol();
    protocol.code = dto.code;
    protocol.name = dto.name;
    protocol.description = dto.description;
    protocol.subgroupCode = dto.subgroupCode;
    protocol.priority = dto.priority ?? 0;
    protocol.isDefault = dto.isDefault ?? false;
    protocol.active = dto.active ?? true;
    protocol.clinicalNotes = dto.clinicalNotes;
    protocol.group = group;
    protocol.frequencies = dto.frequencies.map((frequencyDto) => {
      const frequency = new ClinicalProtocolFrequency();
      frequency.frequency = frequencyDto.frequency;
      frequency.label = frequencyDto.label;
      frequency.allowedRecurrenceTypes = frequencyDto.allowedRecurrenceTypes;
      frequency.allowsPrn = frequencyDto.allowsPrn ?? false;
      frequency.allowsVariableDoseBySchedule =
        frequencyDto.allowsVariableDoseBySchedule ?? false;
      frequency.steps = frequencyDto.steps.map((stepDto) => {
        const step = new ClinicalProtocolStep();
        step.doseLabel = stepDto.doseLabel;
        step.anchor = stepDto.anchor;
        step.offsetMinutes = stepDto.offsetMinutes;
        step.semanticTag = stepDto.semanticTag ?? ClinicalSemanticTag.STANDARD;
        return step;
      });
      return frequency;
    });
    protocol.interactionRules = (dto.interactionRules ?? []).map((ruleDto) => {
      const rule = new ClinicalInteractionRule();
      rule.interactionType =
        ruleDto.interactionType ?? ClinicalInteractionType.AFFECTED_BY_SALTS;
      rule.targetGroupCode = ruleDto.targetGroupCode;
      rule.targetProtocolCode = ruleDto.targetProtocolCode;
      rule.resolutionType =
        ruleDto.resolutionType ?? ClinicalResolutionType.INACTIVATE_SOURCE;
      rule.windowMinutes = ruleDto.windowMinutes;
      rule.windowBeforeMinutes = ruleDto.windowBeforeMinutes ?? ruleDto.windowMinutes;
      rule.windowAfterMinutes = ruleDto.windowAfterMinutes ?? ruleDto.windowMinutes;
      rule.applicableSemanticTags = ruleDto.applicableSemanticTags;
      rule.priority = ruleDto.priority ?? 0;
      return rule;
    });
    return protocol;
  }
}
