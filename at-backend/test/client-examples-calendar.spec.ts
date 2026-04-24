import { ClinicalAnchor } from '../src/common/enums/clinical-anchor.enum';
import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../src/common/enums/clinical-semantic-tag.enum';
import { ConflictMatchKind } from '../src/common/enums/conflict-match-kind.enum';
import { ConflictReasonCode } from '../src/common/enums/conflict-reason-code.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { MonthlySpecialReference } from '../src/common/enums/monthly-special-reference.enum';
import { OcularLaterality } from '../src/common/enums/ocular-laterality.enum';
import { OticLaterality } from '../src/common/enums/otic-laterality.enum';
import { PrnReason } from '../src/common/enums/prn-reason.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  CalendarScheduleItemDto,
  CalendarScheduleResponseDto,
} from '../src/modules/scheduling/dto/calendar-schedule-response.dto';
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
} from './helpers/scheduling-test-helpers';

describe('Client document calendar examples', () => {
  const standardRoutine = buildRoutine({
    acordar: '06:00',
    cafe: '07:00',
    almoco: '13:00',
    lanche: '16:00',
    jantar: '19:00',
    dormir: '21:00',
  });

  function item(
    result: CalendarScheduleResponseDto,
    medicationName: string,
    phaseOrder = 1,
  ): CalendarScheduleItemDto {
    const found = result.scheduleItems.find(
      (scheduleItem) =>
        scheduleItem.medicamento === medicationName &&
        scheduleItem.phaseOrder === phaseOrder,
    );
    expect(found).toBeDefined();
    return found as CalendarScheduleItemDto;
  }

  function doseTimes(result: CalendarScheduleResponseDto, medicationName: string): string[] {
    return item(result, medicationName).doses.map((dose) => dose.horario);
  }

  function buildDeltaMedication(
    commercialName: string,
    protocolCode: string,
    frequency: number,
    options: {
      activePrinciple: string;
      administrationRoute: string;
      doseValue?: string;
      doseUnit?: DoseUnit;
      doseAmount?: string;
    },
  ) {
    return buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName,
        activePrinciple: options.activePrinciple,
        administrationRoute: options.administrationRoute,
        usageInstructions: 'Administrar conforme prescrição.',
      },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
        code: protocolCode,
      }),
      phases: [
        buildPhase({
          frequency,
          doseAmount: options.doseAmount,
          doseValue: options.doseValue,
          doseUnit: options.doseUnit,
          treatmentDays: 7,
        }),
      ],
    });
  }

  it('ALENDRONATO renders weekly BIFOS schedule at one hour before waking', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'ALENDRONATO',
          activePrinciple: 'Alendronato de sodio',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar em jejum com agua.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_BIFOS),
        phases: [
          buildPhase({
            frequency: 1,
            recurrenceType: TreatmentRecurrence.WEEKLY,
            weeklyDay: 'SEGUNDA',
            treatmentDays: 30,
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
          }),
        ],
      }),
    ]);

    const alendronato = item(result, 'ALENDRONATO');
    expect(alendronato).toMatchObject({
      recorrenciaTexto: 'Semanal: segunda-feira',
    });
    expect(alendronato.doses).toEqual([
      expect.objectContaining({
        horario: '05:00',
        contextoHorario: expect.objectContaining({
          ancora: ClinicalAnchor.ACORDAR,
          deslocamento_minutos: -60,
        }),
      }),
    ]);
  });

  it('DORALGINA renders GROUP_I PRN 6/6h schedule from waking time', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'DORALGINA',
          activePrinciple: 'Dipirona + isometepteno + cafeína',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Tomar em caso de dor.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        phases: [
          buildPhase({
            frequency: 4,
            recurrenceType: TreatmentRecurrence.PRN,
            prnReason: PrnReason.PAIN,
            treatmentDays: 6,
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
          }),
        ],
      }),
    ]);

    const doralgina = item(result, 'DORALGINA');
    expect(doralgina).toMatchObject({
      recorrenciaTexto: 'Em caso de dor',
      inicio: '17/04/2026',
      termino: '22/04/2026',
    });
    expect(doralgina.doses.map((dose) => dose.horario)).toEqual([
      '06:00',
      '12:00',
      '18:00',
      '24:00',
    ]);
    expect(doralgina.doses.map((dose) => dose.contextoHorario)).toEqual([
      expect.objectContaining({
        ancora: ClinicalAnchor.ACORDAR,
        deslocamento_minutos: 0,
      }),
      expect.objectContaining({
        ancora: ClinicalAnchor.ACORDAR,
        deslocamento_minutos: 360,
      }),
      expect.objectContaining({
        ancora: ClinicalAnchor.ACORDAR,
        deslocamento_minutos: 720,
      }),
      expect.objectContaining({
        ancora: ClinicalAnchor.ACORDAR,
        deslocamento_minutos: 1080,
      }),
    ]);
  });

  it('GANSULIN R renders the rapid-insulin calendar at 30 minutes before meals with glycemia scale text', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GANSULIN R',
          activePrinciple: 'Insulina Humana Regular 100 UI/ml',
          presentation: 'Frasco com 100 ml',
          administrationRoute: 'SC',
          usageInstructions: 'Aplicar antes das refeições.',
          requiresGlycemiaScale: true,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_INSUL_RAPIDA, {
          frequencies: [
            {
              frequency: 4,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.CAFE, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D2', anchor: ClinicalAnchor.ALMOCO, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D3', anchor: ClinicalAnchor.LANCHE, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D4', anchor: ClinicalAnchor.JANTAR, offsetMinutes: -30, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 4,
            doseAmount: 'Conforme glicemia',
            continuousUse: true,
            treatmentDays: undefined,
            glycemiaScaleRanges: [
              { minimum: 140, maximum: 180, doseValue: '2', doseUnit: DoseUnit.UI },
              { minimum: 181, maximum: 220, doseValue: '4', doseUnit: DoseUnit.UI },
              { minimum: 221, maximum: 300, doseValue: '6', doseUnit: DoseUnit.UI },
            ],
          }),
        ],
      }),
    ]);

    const gansulin = item(result, 'GANSULIN R');
    expect(gansulin.doses.map((dose) => dose.horario)).toEqual([
      '06:30',
      '12:30',
      '15:30',
      '18:30',
    ]);
    expect(gansulin.recorrenciaTexto).toBe('Uso contínuo');
    expect(gansulin.observacoes.join(' ')).toContain(
      'Se glicemia entre 140 e 180: aplicar 2 UI.',
    );
    expect(gansulin.doses.every((dose) => dose.status === ScheduleStatus.ACTIVE)).toBe(true);
  });

  it('XALACOM and OTOCIRIAX expose ocular and otological laterality in the final contract', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'XALACOM',
          activePrinciple: 'Latanoprosta 50 mcg + Timolol 5 mg',
          presentation: 'Frasco 2,5 ml',
          pharmaceuticalForm: 'Solução oftálmica',
          administrationRoute: 'OCULAR',
          usageInstructions: 'Aplicar 1 gota à noite.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
          code: 'DELTA_OCULAR_BEDTIME',
          frequencies: [
            {
              frequency: 1,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 1,
            doseValue: '1',
            doseUnit: DoseUnit.GOTAS,
            continuousUse: true,
            treatmentDays: undefined,
            ocularLaterality: OcularLaterality.BOTH_EYES,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'OTOCIRIAX',
          activePrinciple: 'Ciprofloxacino 2 mg/ml + Hidrocortisona 10mg/ml',
          presentation: 'Frasco 5 ml',
          pharmaceuticalForm: 'Solução otológica',
          administrationRoute: 'OTOLÓGICA',
          usageInstructions: 'Aplicar conforme prescrição.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
          code: 'DELTA_OTICO_12H',
          frequencies: [
            {
              frequency: 2,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
                { doseLabel: 'D2', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 720, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 2,
            doseValue: '3',
            doseUnit: DoseUnit.GOTAS,
            treatmentDays: 7,
            oticLaterality: OticLaterality.BOTH_EARS,
          }),
        ],
      }),
    ]);

    expect(item(result, 'XALACOM')).toMatchObject({
      via: 'Via ocular - ambos os olhos',
      modoUso: expect.stringContaining('Aplicar em ambos os olhos.'),
    });
    expect(doseTimes(result, 'XALACOM')).toEqual(['21:00']);
    expect(item(result, 'OTOCIRIAX')).toMatchObject({
      via: 'Via otológica - nas 2 orelhas',
      modoUso: expect.stringContaining('Aplicar nas 2 orelhas.'),
    });
    expect(doseTimes(result, 'OTOCIRIAX')).toEqual(['06:00', '18:00']);
  });

  it('PERLUTAN renders monthly injectable rule using inclusive menstrual ordinal day', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'PERLUTAN',
          activePrinciple: 'Algestona acetofenida + Enantato de estradiol',
          presentation: 'Ampola 1 ml',
          pharmaceuticalForm: 'Solução injetável',
          administrationRoute: 'IM',
          usageInstructions: 'Aplicar por via intramuscular conforme regra mensal.',
          isContraceptiveMonthly: true,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
          code: 'DELTA_PERLUTAN_MONTHLY',
          frequencies: [
            {
              frequency: 1,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 1,
            doseValue: '1',
            doseUnit: DoseUnit.ML,
            recurrenceType: TreatmentRecurrence.MONTHLY,
            monthlyDay: undefined,
            monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
            monthlySpecialBaseDate: '2026-04-01',
            monthlySpecialOffsetDays: 8,
            treatmentDays: undefined,
          }),
        ],
      }),
    ]);

    expect(item(result, 'PERLUTAN')).toMatchObject({
      via: 'IM',
      recorrenciaTexto:
        'Primeira aplicação: 8º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.',
    });
    expect(doseTimes(result, 'PERLUTAN')).toEqual(['06:00']);
  });

  it('CONTRAVE preserves successive phase blocks, dates and per-dose values from the example', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'CONTRAVE',
            activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
            presentation: 'Comprimido revestido de liberação prolongada',
            administrationRoute: 'VO',
            usageInstructions: 'Não tome com refeições com alto teor de gordura.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
            code: 'GROUP_III_CONTRAVE',
          }),
          phases: [
            buildPhase({ phaseOrder: 1, frequency: 1, treatmentDays: 7, doseValue: '1', doseUnit: DoseUnit.COMP }),
            buildPhase({ phaseOrder: 2, frequency: 2, treatmentDays: 7, doseValue: '1', doseUnit: DoseUnit.COMP }),
            buildPhase({
              phaseOrder: 3,
              frequency: 2,
              treatmentDays: 7,
              sameDosePerSchedule: false,
              perDoseOverrides: [
                { doseLabel: 'D1', doseValue: '2', doseUnit: DoseUnit.COMP },
                { doseLabel: 'D2', doseValue: '1', doseUnit: DoseUnit.COMP },
              ],
            }),
            buildPhase({
              phaseOrder: 4,
              frequency: 2,
              continuousUse: true,
              treatmentDays: undefined,
              doseValue: '2',
              doseUnit: DoseUnit.COMP,
            }),
          ],
        }),
      ],
      { startedAt: '2026-02-20' },
    );

    expect(result.scheduleItems.filter((scheduleItem) => scheduleItem.medicamento === 'CONTRAVE')).toHaveLength(4);
    expect(item(result, 'CONTRAVE', 1)).toMatchObject({ inicio: '20/02/2026', termino: '26/02/2026' });
    expect(item(result, 'CONTRAVE', 2).doses.map((dose) => dose.horario)).toEqual(['07:00', '19:00']);
    expect(item(result, 'CONTRAVE', 3).doses.map((dose) => dose.doseExibicao)).toEqual(['2 COMP', '1 COMP']);
    expect(item(result, 'CONTRAVE', 4)).toMatchObject({ inicio: '13/03/2026', termino: null, recorrenciaTexto: 'Uso contínuo' });
  });

  it('SIMETICONA renders GROUP_I_SIME in the final calendar contract with post-meal times', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SIMETICONA',
          activePrinciple: 'Simeticona 75 mg/ml',
          presentation: 'Frasco 15 ml',
          pharmaceuticalForm: 'Solução oral',
          administrationRoute: 'Via oral',
          usageInstructions: 'Administrar conforme prescrição.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SIME),
        phases: [
          buildPhase({
            frequency: 3,
            doseValue: '15',
            doseUnit: DoseUnit.ML,
            treatmentDays: 7,
          }),
        ],
      }),
    ]);

    expect(item(result, 'SIMETICONA')).toMatchObject({
      via: 'Via oral',
      recorrenciaTexto: 'Diário',
      modoUso: expect.stringContaining('Administrar conforme prescrição.'),
    });
    expect(doseTimes(result, 'SIMETICONA')).toEqual(['08:00', '17:00', '20:00']);
  });

  it('Grupo Delta default protocols render each non-oral family without manual snapshots', async () => {
    const { service } = createSchedulingService({
      routine: buildRoutine({ ...standardRoutine, banho: '08:30' }),
    });
    const result = await buildScheduleResult(service, [
      buildDeltaMedication('XALACOM', 'DELTA_OCULAR_BEDTIME', 1, {
        activePrinciple: 'Latanoprosta + Timolol',
        administrationRoute: 'Via ocular',
        doseValue: '1',
        doseUnit: DoseUnit.GOTAS,
      }),
      buildDeltaMedication('OTOCIRIAX', 'DELTA_OTICO_12H', 2, {
        activePrinciple: 'Ciprofloxacino + Hidrocortisona',
        administrationRoute: 'Via otológica',
        doseValue: '3',
        doseUnit: DoseUnit.GOTAS,
      }),
      buildDeltaMedication('METRONIDAZOL', 'DELTA_METRONIDAZOL_VAGINAL', 1, {
        activePrinciple: 'Metronidazol 100mg/g',
        administrationRoute: 'VIA VAGINAL',
        doseValue: '1',
        doseUnit: DoseUnit.APLICADOR,
      }),
      buildDeltaMedication('CETOCONAZOL', 'DELTA_TOPICO_APOS_BANHO', 1, {
        activePrinciple: 'Cetoconazol 20mg/g',
        administrationRoute: 'USO TOPICO',
        doseAmount: 'AREA AFETADA',
      }),
      buildDeltaMedication('BUDESONIDA NASAL', 'DELTA_INTRANASAL_WAKE', 1, {
        activePrinciple: 'Budesonida',
        administrationRoute: 'Via intra nasal',
        doseValue: '1',
        doseUnit: DoseUnit.JATOS,
      }),
      buildDeltaMedication('SUPOSITORIO DE GLICERINA', 'DELTA_RETAL_BEDTIME', 1, {
        activePrinciple: 'Glicerina',
        administrationRoute: 'Via retal',
        doseValue: '1',
        doseUnit: DoseUnit.SUPOSITORIO,
      }),
      buildDeltaMedication('NITROGLICERINA', 'DELTA_SUBLINGUAL_WAKE', 1, {
        activePrinciple: 'Nitroglicerina',
        administrationRoute: 'Via sublingual',
        doseValue: '1',
        doseUnit: DoseUnit.COMP,
      }),
      buildDeltaMedication('SALBUTAMOL', 'DELTA_INALATORIO_12H', 2, {
        activePrinciple: 'Salbutamol',
        administrationRoute: 'Via inalatória',
        doseValue: '2',
        doseUnit: DoseUnit.JATOS,
      }),
    ]);

    expect(result.routine.banho).toBe('08:30');
    expect(doseTimes(result, 'XALACOM')).toEqual(['21:00']);
    expect(doseTimes(result, 'OTOCIRIAX')).toEqual(['06:00', '18:00']);
    expect(doseTimes(result, 'METRONIDAZOL')).toEqual(['20:40']);
    expect(doseTimes(result, 'CETOCONAZOL')).toEqual(['08:30']);
    expect(item(result, 'CETOCONAZOL').doses[0].contextoHorario).toMatchObject({
      ancora: ClinicalAnchor.APOS_BANHO,
      ancora_horario_minutos: 510,
    });
    expect(doseTimes(result, 'BUDESONIDA NASAL')).toEqual(['06:00']);
    expect(doseTimes(result, 'SUPOSITORIO DE GLICERINA')).toEqual(['21:00']);
    expect(doseTimes(result, 'NITROGLICERINA')).toEqual(['06:00']);
    expect(doseTimes(result, 'SALBUTAMOL')).toEqual(['06:00', '18:00']);
  });

  it('requires manual adjustment for APOS_BANHO when routine has no bath time', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildDeltaMedication('CETOCONAZOL', 'DELTA_TOPICO_APOS_BANHO', 1, {
        activePrinciple: 'Cetoconazol 20mg/g',
        administrationRoute: 'USO TOPICO',
        doseAmount: 'AREA AFETADA',
      }),
    ]);

    expect(result.routine.banho).toBeNull();
    expect(item(result, 'CETOCONAZOL').doses[0]).toMatchObject({
      horario: '06:00',
      status: ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
      reasonCode: ConflictReasonCode.MANUAL_REQUIRED_MISSING_ROUTINE_ANCHOR,
      contextoHorario: expect.objectContaining({
        ancora: ClinicalAnchor.APOS_BANHO,
        ancora_horario_minutos: null,
      }),
    });
  });

  it('GASTROGEL and SUCRAFILM follow the conflict examples for salts and sucralfate', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'GASTROGEL' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
        phases: [buildPhase({ frequency: 2, doseValue: '10', doseUnit: DoseUnit.ML })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'CAPTOPRIL' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 1,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
            targetGroupCode: GroupCode.GROUP_III_SAL,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
          }),
        ],
        phases: [buildPhase({ frequency: 1 })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'SUCRAFILM' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [buildPhase({ frequency: 2, doseValue: '10', doseUnit: DoseUnit.ML })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'LOSARTANA MANHÃ' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 1,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.ACORDAR, offsetMinutes: 120, semanticTag: ClinicalSemanticTag.STANDARD },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            windowMinutes: 420,
          }),
        ],
        phases: [buildPhase({ frequency: 1 })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'ZOLPIDEM' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 1,
              steps: [
                { doseLabel: 'D1', anchor: ClinicalAnchor.DORMIR, offsetMinutes: 0, semanticTag: ClinicalSemanticTag.BEDTIME_SLOT },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
          }),
        ],
        phases: [buildPhase({ frequency: 1 })],
      }),
    ]);

    const saltAt21 = item(result, 'GASTROGEL').doses.find((dose) => dose.horario === '21:00');
    expect(saltAt21).toMatchObject({
      status: ScheduleStatus.INACTIVE,
      reasonCode: ConflictReasonCode.INACTIVATED_BY_MANDATORY_RULE,
    });
    const shiftedSucralfate = item(result, 'SUCRAFILM').doses.find((dose) => dose.horario === '15:00');
    expect(shiftedSucralfate).toMatchObject({
      status: ScheduleStatus.ACTIVE,
      reasonCode: ConflictReasonCode.SHIFTED_BY_WINDOW_CONFLICT,
    });
    const bedtimeSucralfate = item(result, 'SUCRAFILM').doses.find((dose) => dose.horario === '21:00');
    expect(bedtimeSucralfate).toMatchObject({
      status: ScheduleStatus.INACTIVE,
      conflito: expect.objectContaining({
        tipo_match_codigo: ConflictMatchKind.MANDATORY_INACTIVATION,
      }),
    });
  });

  it('CALCIO keeps CAFÉ + 3H and DORMIR, shifts by one hour, then manualizes persistent conflicts', async () => {
    const { service } = createSchedulingService({ routine: standardRoutine });
    const shifted = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'CALCIO' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
        phases: [buildPhase({ frequency: 2 })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'BLOQUEADOR 21' },
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          }),
        ],
        phases: [buildPhase({ frequency: 1, manualAdjustmentEnabled: true, manualTimes: ['21:00'] })],
      }),
    ]);

    expect(doseTimes(shifted, 'CALCIO')).toEqual(['10:00', '22:00']);
    expect(item(shifted, 'CALCIO').doses.find((dose) => dose.horario === '22:00')).toMatchObject({
      status: ScheduleStatus.ACTIVE,
      reasonCode: ConflictReasonCode.SHIFTED_BY_WINDOW_CONFLICT,
    });

    const persistent = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'CALCIO' },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
        phases: [buildPhase({ frequency: 2 })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'BLOQUEADOR 21' },
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          }),
        ],
        phases: [buildPhase({ frequency: 1, manualAdjustmentEnabled: true, manualTimes: ['21:00'] })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: 'BLOQUEADOR 22' },
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
          }),
        ],
        phases: [buildPhase({ frequency: 1, manualAdjustmentEnabled: true, manualTimes: ['22:00'] })],
      }),
    ]);

    expect(item(persistent, 'CALCIO').doses.find((dose) => dose.horario === '22:00')).toMatchObject({
      status: ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
      reasonCode: ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
    });
  });
});
