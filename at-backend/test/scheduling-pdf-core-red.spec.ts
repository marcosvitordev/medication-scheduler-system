import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { ConflictMatchKind } from '../src/common/enums/conflict-match-kind.enum';
import { ConflictReasonCode } from '../src/common/enums/conflict-reason-code.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
  expectEntry,
  expectInactiveEntry,
  findEntriesByMedication,
  findEntriesByMedicationAndTime,
  findEntryByTime,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService PDF core rules', () => {
  describe('sais e antiacidos', () => {
    it('keeps GASTROGEL active at 09:00 and 21:00 when no sensitive medication shares those slots', async () => {
      const { service } = createSchedulingService({
        routine: buildRoutine({
          acordar: '06:00',
          cafe: '07:00',
          almoco: '13:00',
          lanche: '16:00',
          jantar: '19:00',
          dormir: '21:00',
        }),
      });

      const gastrogel = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GASTROGEL',
          activePrinciple:
            'Hidroxido de aluminio + Hidroxido de magnesio + simeticona',
          presentation: 'Suspensao oral 150 ml',
          administrationRoute: 'VO',
          usageInstructions: 'Agite o frasco antes de usar.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 5,
          }),
        ],
      });

      const metformina = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GLIFAGE',
          activePrinciple: 'Metformina',
          presentation: 'Comprimido revestido',
          administrationRoute: 'VO',
          usageInstructions: 'Tomar junto das refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_MET),
        phases: [buildPhase({ frequency: 2, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [gastrogel, metformina]);

      expectEntry(findEntryByTime(result, 'GASTROGEL', '09:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
      expectEntry(findEntryByTime(result, 'GASTROGEL', '21:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
    });

    it('inactivates the bedtime salt dose when a sensitive medication shares 21:00', async () => {
      const { service } = createSchedulingService({
        routine: buildRoutine({
          acordar: '06:00',
          cafe: '07:00',
          almoco: '13:00',
          lanche: '16:00',
          jantar: '19:00',
          dormir: '21:00',
        }),
      });

      const gastrogel = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'GASTROGEL',
          activePrinciple: 'Hidroxido de aluminio + magnesio',
          presentation: 'Suspensao oral',
          administrationRoute: 'VO',
          usageInstructions: 'Agite o frasco antes de usar.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 5,
          }),
        ],
      });

      const captopril = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CAPTOPRIL',
          activePrinciple: 'Captopril',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Conforme prescricao.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SALTS,
            targetGroupCode: GroupCode.GROUP_III_SAL,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 3,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
            treatmentDays: 30,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [gastrogel, captopril]);

      const inactiveSaltEntry = findEntryByTime(result, 'GASTROGEL', '21:00');
      expectInactiveEntry(inactiveSaltEntry, {
        administrationLabel: '10 ML',
      });
      expect(inactiveSaltEntry?.note).toContain('CAPTOPRIL');
      expectEntry(findEntryByTime(result, 'CAPTOPRIL', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });
  });

  describe('sucralfato', () => {
    const routine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildSucralfatoMedication() {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });
    }

    it('keeps SUCRAFILM at 08:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine });

      const result = await buildScheduleResult(service, [buildSucralfatoMedication()]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
        recurrenceLabel: 'Diario',
      });
    });

    it('keeps SUCRAFILM fixed and marks LOSARTANA as manual when the shifted slot still falls inside another sucralfate window', async () => {
      const { service } = createSchedulingService({ routine });

      const morningInteractor = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'LOSARTANA',
          activePrinciple: 'Losartana potassica',
          presentation: 'Comprimido revestido',
          administrationRoute: 'VO',
          usageInstructions: 'Conforme orientacao clinica.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            windowMinutes: 420,
            priority: 100,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '1 COMP',
            manualAdjustmentEnabled: true,
            manualTimes: ['08:00'],
            treatmentDays: 30,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        morningInteractor,
      ]);

      const movedEntry = findEntryByTime(result, 'LOSARTANA', '15:00');
      expect(movedEntry?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(movedEntry?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
      );
      expect(movedEntry?.timeContext.originalTimeFormatted).toBe('08:00');
      expect(movedEntry?.timeContext.resolvedTimeFormatted).toBe('15:00');
      expect(movedEntry?.conflict).toMatchObject({
        interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
        resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
        triggerMedicationName: 'SUCRAFILM',
        windowAfterMinutes: 420,
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntriesByMedicationAndTime(result, 'LOSARTANA', '15:00')).toHaveLength(1);
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
    });

    it('treats GROUP_I_SED at 20:40 as clinically equivalent to bedtime and inactivates CLONAZEPAM instead of SUCRAFILM', async () => {
      const { service } = createSchedulingService({ routine });

      const clonazepam = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CLONAZEPAM',
          activePrinciple: 'Clonazepam',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar 20 minutos antes de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        clonazepam,
      ]);

      expectInactiveEntry(findEntryByTime(result, 'CLONAZEPAM', '20:40'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
    });

    it('keeps SUCRAFILM fixed and manualizes the shifted morning blocker when the afternoon window remains clinically conflicting', async () => {
      const { service } = createSchedulingService({ routine });

      const morningBlock = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'LOSARTANA MANHA',
          activePrinciple: 'Losartana matinal',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Interacao matinal canônica.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            windowMinutes: 420,
            priority: 100,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ['08:00'],
            treatmentDays: 10,
          }),
        ],
      });

      const afternoonBlock = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'LOSARTANA TARDE',
          activePrinciple: 'Losartana vespertina',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Interacao persistente canônica.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            priority: 200,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ['15:00'],
            treatmentDays: 10,
          }),
        ],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        morningBlock,
        afternoonBlock,
      ]);

      const shiftedMorning = findEntryByTime(result, 'LOSARTANA MANHA', '15:00');
      expect(shiftedMorning?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(shiftedMorning?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
      );
      expect(shiftedMorning?.timeContext.originalTimeFormatted).toBe('08:00');
      expect(shiftedMorning?.timeContext.resolvedTimeFormatted).toBe('15:00');
      expect(shiftedMorning?.conflict).toMatchObject({
        interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
        resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
        triggerMedicationName: 'SUCRAFILM',
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntriesByMedication(result, 'SUCRAFILM')).toHaveLength(2);
    });

    it('keeps SUCRAFILM fixed and inactivates only the bedtime blocker when the conflict exists at 21:00', async () => {
      const { service } = createSchedulingService({ routine });

      const bedtimeConflict = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'ZOLPIDEM',
          activePrinciple: 'Zolpidem',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar ao dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          code: 'GROUP_I_BEDTIME_EXACT',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: 0,
                  semanticTag: 'BEDTIME_SLOT' as never,
                },
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
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [
        buildSucralfatoMedication(),
        bedtimeConflict,
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expectInactiveEntry(findEntryByTime(result, 'ZOLPIDEM', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('uses only ACORDAR + 2h when SUCRAFILM frequency is 1', async () => {
      const { service } = createSchedulingService({ routine });

      const result = await buildScheduleResult(service, [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'SUCRAFILM',
            activePrinciple: 'Sucralfato',
            presentation: 'Suspensao oral',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme protocolo.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
          phases: [
            buildPhase({
              frequency: 1,
              doseAmount: '10 ML',
              doseValue: '10',
              doseUnit: DoseUnit.ML,
              treatmentDays: 10,
            }),
          ],
        }),
      ]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '08:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntryByTime(result, 'SUCRAFILM', '21:00')).toBeUndefined();
    });
  });

  describe('calcio', () => {
    const routine = buildRoutine({
      acordar: '05:00',
      cafe: '07:00',
      almoco: '12:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildCalciumMedication() {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CALCIO',
          activePrinciple: 'Carbonato de calcio',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Usar afastado de interacoes clinicas.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
            treatmentDays: 30,
          }),
        ],
      });
    }

    function buildCalciumSensitiveMedication(
      name: string,
      time: string,
      note = 'Horario fixo de conflito para o calcio.',
      interactionRuleOverrides: Partial<ReturnType<typeof buildInteractionRule>> = {},
    ) {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: name,
          activePrinciple: name,
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: note,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            ...interactionRuleOverrides,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '1 COMP',
            manualAdjustmentEnabled: true,
            manualTimes: [time],
            treatmentDays: 30,
          }),
        ],
      });
    }

    it('keeps GROUP_III_CALC at 10:00 and 21:00 when there is no conflict', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [buildCalciumMedication()]);

      expectEntry(findEntryByTime(result, 'CALCIO', '10:00'), {
        administrationLabel: '1 COMP',
      });
      expectEntry(findEntryByTime(result, 'CALCIO', '21:00'), {
        administrationLabel: '1 COMP',
      });
    });

    it('moves the bedtime calcium dose to 22:00 when a conflicting medication occupies 21:00', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('LEVOTIROXINA', '21:00'),
      ]);

      const movedCalcium = findEntryByTime(result, 'CALCIO', '22:00');
      expectEntry(movedCalcium, {
        administrationLabel: '1 COMP',
      });
      expect(movedCalcium?.note).toContain('LEVOTIROXINA');
      expect(findEntryByTime(result, 'CALCIO', '21:00')).toBeUndefined();
      expect(findEntriesByMedicationAndTime(result, 'CALCIO', '22:00')).toHaveLength(1);
    });

    it('moves the morning calcium dose to 11:00 when the conflict exists at 10:00', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('DOXICICLINA', '10:00'),
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '11:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '10:00')).toBeUndefined();
      expect(findEntryByTime(result, 'CALCIO', '21:00')).toBeDefined();
    });

    it('moves calcium only once even when multiple medications share the original conflicting time', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('MEDICAMENTO A', '21:00'),
        buildCalciumSensitiveMedication('MEDICAMENTO B', '21:00'),
      ]);

      expectEntry(findEntryByTime(result, 'CALCIO', '22:00'), {
        administrationLabel: '1 COMP',
      });
      expect(findEntryByTime(result, 'CALCIO', '23:00')).toBeUndefined();
      expect(findEntriesByMedicationAndTime(result, 'CALCIO', '22:00')).toHaveLength(1);
    });

    it('marks calcium as MANUAL_ADJUSTMENT_REQUIRED when the shifted time still conflicts', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('MEDICAMENTO 21', '21:00'),
        buildCalciumSensitiveMedication('MEDICAMENTO 22', '22:00'),
      ]);

      const calciumEntry = findEntryByTime(result, 'CALCIO', '22:00');
      expect(calciumEntry).toBeDefined();
      expect(calciumEntry?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumEntry?.note).toContain('ajuste manual');
    });

    it('revalidates the shifted calcium dose against a clinical window even when no second exact-minute collision exists', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('BLOQUEADOR 21', '21:00'),
        buildCalciumSensitiveMedication(
          'BLOQUEADOR 22H30',
          '22:30',
          'Conflito por janela clínica após deslocamento.',
          {
            windowMinutes: 60,
          },
        ),
      ]);

      const calciumEntry = findEntryByTime(result, 'CALCIO', '22:00');
      expect(calciumEntry).toBeDefined();
      expect(calciumEntry?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumEntry?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
      );
      expect(calciumEntry?.conflict).toMatchObject({
        matchKind: ConflictMatchKind.CLINICAL_WINDOW,
        triggerMedicationName: 'BLOQUEADOR 22H30',
      });
      expect(findEntryByTime(result, 'CALCIO', '22:30')).toBeUndefined();
    });

    it('marks calcium as manual when a 120-minute shift still lands on the conflict window boundary', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('FERRO', '21:00', 'Conflito com calcio.', {
          windowMinutes: 120,
        }),
      ]);

      const calciumEntry = findEntryByTime(result, 'CALCIO', '23:00');
      expect(calciumEntry?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumEntry?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
      );
    });

    it('prefers REQUIRE_MANUAL_ADJUSTMENT over SHIFT_SOURCE_BY_WINDOW when both rules match and manual has higher priority', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication(
          'BLOQUEADOR SHIFT',
          '21:00',
          'Regra de deslocamento.',
          {
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            priority: 10,
          },
        ),
        buildCalciumSensitiveMedication(
          'BLOQUEADOR MANUAL',
          '21:00',
          'Regra de ajuste manual prioritario.',
          {
            resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
            priority: 100,
          },
        ),
      ]);

      const calciumAt21 = findEntryByTime(result, 'CALCIO', '21:00');
      expect(calciumAt21).toBeDefined();
      expect(calciumAt21?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(findEntryByTime(result, 'CALCIO', '22:00')).toBeUndefined();
    });

    it('uses rule priority instead of medication ordering when multiple calcium rules match', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication(
          'AAA SHIFT',
          '21:00',
          'Bloqueador alfabeticamente primeiro.',
          {
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            priority: 10,
          },
        ),
        buildCalciumSensitiveMedication(
          'ZZZ MANUAL',
          '21:00',
          'Bloqueador alfabeticamente depois, mas clinicamente prioritario.',
          {
            resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
            priority: 100,
          },
        ),
      ]);

      const calciumAt21 = findEntryByTime(result, 'CALCIO', '21:00');
      expect(calciumAt21).toBeDefined();
      expect(calciumAt21?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(calciumAt21?.conflict).toMatchObject({
        triggerMedicationName: 'ZZZ MANUAL',
        resolutionType: ClinicalResolutionType.REQUIRE_MANUAL_ADJUSTMENT,
        rulePriority: 100,
      });
    });

    it('is deterministic with multiple blockers and marks manual adjustment at the first persistent conflict slot', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildCalciumMedication(),
        buildCalciumSensitiveMedication('BLOQUEADOR 21', '21:00'),
        buildCalciumSensitiveMedication('BLOQUEADOR 22', '22:00'),
        buildCalciumSensitiveMedication('BLOQUEADOR 23', '23:00'),
      ]);

      const calciumAt22 = findEntryByTime(result, 'CALCIO', '22:00');
      expect(calciumAt22).toBeDefined();
      expect(calciumAt22?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(findEntryByTime(result, 'CALCIO', '23:00')).toBeUndefined();
    });
  });

  describe('prioridade clínica não deslocável', () => {
    const routine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    function buildProtectedMedication(name: string, groupCode: GroupCode, time = '07:00') {
      return buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: name,
          activePrinciple: name,
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Horário clínico prioritário.',
        },
        protocolSnapshot: buildProtocolSnapshot(groupCode),
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '1 COMP',
            manualAdjustmentEnabled: true,
            manualTimes: [time],
            treatmentDays: 10,
          }),
        ],
      });
    }

    it('keeps GROUP_II fixed and marks the movable medication for manual adjustment on exact collision', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildProtectedMedication('ALENDRONATO', GroupCode.GROUP_II_BIFOS),
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'LOSARTANA',
            activePrinciple: 'Losartana',
            presentation: 'Comprimido',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescrição.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
          phases: [
            buildPhase({
              frequency: 1,
              manualAdjustmentEnabled: true,
              manualTimes: ['07:00'],
              treatmentDays: 10,
            }),
          ],
        }),
      ]);

      expect(findEntryByTime(result, 'ALENDRONATO', '07:00')?.status).toBe(
        ScheduleStatus.ACTIVE,
      );
      const losartana = findEntryByTime(result, 'LOSARTANA', '07:00');
      expect(losartana?.status).toBe(ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED);
      expect(losartana?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_NON_MOVABLE_COLLISION,
      );
      expect(losartana?.conflict).toMatchObject({
        matchKind: ConflictMatchKind.PRIORITY_BLOCK,
        triggerMedicationName: 'ALENDRONATO',
      });
    });

    it('keeps insulin fixed and marks the movable medication for manual adjustment on exact collision', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildProtectedMedication('INSULINA RÁPIDA', GroupCode.GROUP_INSUL_RAPIDA),
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: 'OMEPRAZOL',
            activePrinciple: 'Omeprazol',
            presentation: 'Cápsula',
            administrationRoute: 'VO',
            usageInstructions: 'Conforme prescrição.',
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
          phases: [
            buildPhase({
              frequency: 1,
              manualAdjustmentEnabled: true,
              manualTimes: ['07:00'],
              treatmentDays: 10,
            }),
          ],
        }),
      ]);

      expect(findEntryByTime(result, 'INSULINA RÁPIDA', '07:00')?.status).toBe(
        ScheduleStatus.ACTIVE,
      );
      expect(findEntryByTime(result, 'OMEPRAZOL', '07:00')?.status).toBe(
        ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
      );
    });

    it('marks one protected dose as manual when insulin and GROUP_II collide', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildProtectedMedication('BIFOS PRIORITARIO', GroupCode.GROUP_II_BIFOS),
        buildProtectedMedication('INSULINA BASAL', GroupCode.GROUP_INSUL_LONGA),
      ]);

      const statuses = [
        findEntryByTime(result, 'BIFOS PRIORITARIO', '07:00')?.status,
        findEntryByTime(result, 'INSULINA BASAL', '07:00')?.status,
      ];
      expect(statuses.filter((status) => status === ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED)).toHaveLength(1);
      expect(statuses.filter((status) => status === ScheduleStatus.ACTIVE)).toHaveLength(1);

      const manualEntry =
        findEntryByTime(result, 'BIFOS PRIORITARIO', '07:00')?.status ===
        ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED
          ? findEntryByTime(result, 'BIFOS PRIORITARIO', '07:00')
          : findEntryByTime(result, 'INSULINA BASAL', '07:00');

      expect(manualEntry?.reasonCode).toBe(
        ConflictReasonCode.MANUAL_REQUIRED_NON_MOVABLE_COLLISION,
      );
      expect(manualEntry?.conflict?.matchKind).toBe(ConflictMatchKind.PRIORITY_BLOCK);
    });

    it('marks one insulin dose as manual when two protected insulin doses collide', async () => {
      const { service } = createSchedulingService({ routine });
      const result = await buildScheduleResult(service, [
        buildProtectedMedication('INSULINA A', GroupCode.GROUP_INSUL_RAPIDA),
        buildProtectedMedication('INSULINA B', GroupCode.GROUP_INSUL_LONGA),
      ]);

      const insulinA = findEntryByTime(result, 'INSULINA A', '07:00');
      const insulinB = findEntryByTime(result, 'INSULINA B', '07:00');

      expect(
        [insulinA?.status, insulinB?.status].filter(
          (status) => status === ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
        ),
      ).toHaveLength(1);
      expect(
        [insulinA?.status, insulinB?.status].filter(
          (status) => status === ScheduleStatus.ACTIVE,
        ),
      ).toHaveLength(1);
    });
  });

  describe('sucralfato com janela configuravel', () => {
    const routine = buildRoutine({
      acordar: '06:00',
      cafe: '07:00',
      almoco: '13:00',
      lanche: '16:00',
      jantar: '19:00',
      dormir: '21:00',
    });

    it('keeps SUCRAFILM fixed and inactivates the bedtime-equivalent blocker when the rule window is 30', async () => {
      const { service } = createSchedulingService({ routine });

      const sucralfato = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });

      const sedativo = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SEDATIVO TESTE',
          activePrinciple: 'Sedativo',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar proximo ao horario de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED, {
          code: 'GROUP_I_SED_2031',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: -29,
                  semanticTag: 'BEDTIME_EQUIVALENT' as never,
                },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            windowMinutes: 30,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [sucralfato, sedativo]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expectInactiveEntry(findEntryByTime(result, 'SEDATIVO TESTE', '20:31'), {
        administrationLabel: '1 COMP',
      });
    });

    it('does not inactivate SUCRAFILM when bedtime-equivalent conflict is outside configured window', async () => {
      const { service } = createSchedulingService({ routine });

      const sucralfato = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SUCRAFILM',
          activePrinciple: 'Sucralfato 200mg/ml',
          presentation: 'Suspensao oral 10 ml',
          administrationRoute: 'VO',
          usageInstructions: '1 hora antes ou 2 horas apos as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
        phases: [
          buildPhase({
            frequency: 2,
            doseAmount: '10 ML',
            doseValue: '10',
            doseUnit: DoseUnit.ML,
            treatmentDays: 30,
          }),
        ],
      });

      const sedativo = buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'SEDATIVO LIMITE',
          activePrinciple: 'Sedativo Limite',
          presentation: 'Comprimido',
          administrationRoute: 'VO',
          usageInstructions: 'Administrar proximo ao horario de dormir.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I_SED, {
          code: 'GROUP_I_SED_2039',
          frequencies: [
            {
              frequency: 1,
              steps: [
                {
                  doseLabel: 'D1',
                  anchor: 'DORMIR' as never,
                  offsetMinutes: -21,
                  semanticTag: 'BEDTIME_EQUIVALENT' as never,
                },
              ],
            },
          ],
        }),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
            targetGroupCode: GroupCode.GROUP_II_SUCRA,
            resolutionType: ClinicalResolutionType.INACTIVATE_SOURCE,
            windowMinutes: 20,
          }),
        ],
        phases: [buildPhase({ frequency: 1, doseAmount: '1 COMP' })],
      });

      const result = await buildScheduleResult(service, [sucralfato, sedativo]);

      expectEntry(findEntryByTime(result, 'SUCRAFILM', '21:00'), {
        administrationLabel: '10 ML',
      });
      expect(findEntryByTime(result, 'SUCRAFILM', '15:00')).toBeUndefined();
    });
  });
});
