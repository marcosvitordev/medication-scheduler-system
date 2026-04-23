import { ClinicalAnchor } from "../../src/common/enums/clinical-anchor.enum";
import { ClinicalInteractionType } from "../../src/common/enums/clinical-interaction-type.enum";
import { ClinicalResolutionType } from "../../src/common/enums/clinical-resolution-type.enum";
import { ClinicalSemanticTag } from "../../src/common/enums/clinical-semantic-tag.enum";
import { DoseUnit } from "../../src/common/enums/dose-unit.enum";
import { GroupCode } from "../../src/common/enums/group-code.enum";
import { MonthlySpecialReference } from "../../src/common/enums/monthly-special-reference.enum";
import { OcularLaterality } from "../../src/common/enums/ocular-laterality.enum";
import { OticLaterality } from "../../src/common/enums/otic-laterality.enum";
import { PrnReason } from "../../src/common/enums/prn-reason.enum";
import { ScheduleStatus } from "../../src/common/enums/schedule-status.enum";
import { TreatmentRecurrence } from "../../src/common/enums/treatment-recurrence.enum";
import {
  CalendarScheduleDoseDto,
  CalendarScheduleItemDto,
  CalendarScheduleResponseDto,
} from "../../src/modules/scheduling/dto/calendar-schedule-response.dto";
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
} from "./scheduling-test-helpers";

export const clientRoutine = buildRoutine({
  acordar: "06:00",
  cafe: "07:00",
  almoco: "13:00",
  lanche: "16:00",
  jantar: "19:00",
  dormir: "21:00",
  banho: "08:30",
});

export function item(
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

export function doseTimes(
  result: CalendarScheduleResponseDto,
  medicationName: string,
): string[] {
  return item(result, medicationName).doses.map((dose) => dose.horario);
}

export function activeDose(
  result: CalendarScheduleResponseDto,
  medicationName: string,
  time: string,
): CalendarScheduleDoseDto {
  const dose = item(result, medicationName).doses.find(
    (candidate) =>
      candidate.horario === time && candidate.status === ScheduleStatus.ACTIVE,
  );
  expect(dose).toBeDefined();
  return dose as CalendarScheduleDoseDto;
}

export function expectTimeContext(
  dose: CalendarScheduleDoseDto,
  anchor: ClinicalAnchor,
  offsetMinutes: number,
): void {
  expect(dose.contextoHorario).toMatchObject({
    ancora: anchor,
    deslocamento_minutos: offsetMinutes,
  });
}

export function buildAlendronatoWeekly() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "ALENDRONATO",
      activePrinciple: "Alendronato de sodio",
      presentation: "Comprimido",
      administrationRoute: "VO",
      usageInstructions: "Administrar em jejum com agua.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_BIFOS, {
      code: "GROUP_II_BIFOS_STANDARD",
    }),
    phases: [
      buildPhase({
        frequency: 1,
        recurrenceType: TreatmentRecurrence.WEEKLY,
        weeklyDay: "SEGUNDA",
        treatmentDays: 30,
        doseValue: "1",
        doseUnit: DoseUnit.COMP,
      }),
    ],
  });
}

export function buildDoralginaPrn6h() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "DORALGINA",
      activePrinciple: "Dipirona + isometepteno + cafeína",
      presentation: "Comprimido",
      administrationRoute: "VO",
      usageInstructions: "Tomar em caso de dor.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
      code: "GROUP_I_DORALGINA_6H",
    }),
    phases: [
      buildPhase({
        frequency: 4,
        recurrenceType: TreatmentRecurrence.PRN,
        prnReason: PrnReason.PAIN,
        treatmentDays: undefined,
        doseValue: "1",
        doseUnit: DoseUnit.COMP,
      }),
    ],
  });
}

export function buildGenericGroupIIIThreeMeals() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "MEDICAMENTO GRUPO III",
      activePrinciple: "Fármaco relacionado às refeições",
      presentation: "Comprimido",
      administrationRoute: "VO",
      usageInstructions: "Administrar junto às refeições.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
      code: "GROUP_III_CAFE_STANDARD",
    }),
    phases: [
      buildPhase({
        frequency: 3,
        doseValue: "1",
        doseUnit: DoseUnit.COMP,
      }),
    ],
  });
}

export function buildManualAdjustmentMedication() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "LOSARTANA",
      activePrinciple: "Losartana potassica",
      presentation: "Comprimido",
      administrationRoute: "VO",
      usageInstructions: "Conforme prescrição.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
    phases: [
      buildPhase({
        frequency: 2,
        manualAdjustmentEnabled: true,
        manualTimes: ["08:15", "20:45"],
      }),
    ],
  });
}

export function buildXalacomOcular() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "XALACOM",
      activePrinciple: "Latanoprosta 50 mcg + Timolol 5 mg",
      presentation: "Frasco 2,5 ml",
      pharmaceuticalForm: "Solução oftálmica",
      administrationRoute: "OCULAR",
      usageInstructions: "Aplicar 1 gota à noite.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
      code: "DELTA_OCULAR_BEDTIME",
    }),
    phases: [
      buildPhase({
        frequency: 1,
        doseValue: "1",
        doseUnit: DoseUnit.GOTAS,
        continuousUse: true,
        treatmentDays: undefined,
        ocularLaterality: OcularLaterality.BOTH_EYES,
      }),
    ],
  });
}

export function buildOtociriaxOtic() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "OTOCIRIAX",
      activePrinciple: "Ciprofloxacino 2 mg/ml + Hidrocortisona 10mg/ml",
      presentation: "Frasco 5 ml",
      pharmaceuticalForm: "Solução otológica",
      administrationRoute: "OTOLÓGICA",
      usageInstructions: "Aplicar conforme prescrição.",
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
      code: "DELTA_OTICO_12H",
    }),
    phases: [
      buildPhase({
        frequency: 2,
        doseValue: "3",
        doseUnit: DoseUnit.GOTAS,
        treatmentDays: 7,
        oticLaterality: OticLaterality.BOTH_EARS,
      }),
    ],
  });
}

export function buildPerlutanMonthly() {
  return buildPrescriptionMedication({
    medicationSnapshot: {
      commercialName: "PERLUTAN",
      activePrinciple: "Algestona acetofenida + Enantato de estradiol",
      presentation: "Ampola 1 ml",
      pharmaceuticalForm: "Solução injetável",
      administrationRoute: "IM",
      usageInstructions: "Aplicar por via intramuscular conforme regra mensal.",
      isContraceptiveMonthly: true,
    },
    protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
      code: "DELTA_PERLUTAN_MONTHLY",
      frequencies: [
        {
          frequency: 1,
          steps: [
            {
              doseLabel: "D1",
              anchor: ClinicalAnchor.ACORDAR,
              offsetMinutes: 0,
              semanticTag: ClinicalSemanticTag.STANDARD,
            },
          ],
        },
      ],
    }),
    phases: [
      buildPhase({
        frequency: 1,
        doseValue: "1",
        doseUnit: DoseUnit.ML,
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlyDay: undefined,
        monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
        monthlySpecialBaseDate: "2026-04-01",
        monthlySpecialOffsetDays: 8,
        treatmentDays: undefined,
      }),
    ],
  });
}

export function buildSaltConflictScenario() {
  return [
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "GASTROGEL" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_SAL),
      phases: [
        buildPhase({ frequency: 2, doseValue: "10", doseUnit: DoseUnit.ML }),
      ],
    }),
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "CAPTOPRIL" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: "D1",
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
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
  ];
}

export function buildSucralfateConflictScenario() {
  return [
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "SUCRAFILM" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_II_SUCRA),
      phases: [
        buildPhase({ frequency: 2, doseValue: "10", doseUnit: DoseUnit.ML }),
      ],
    }),
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "LOSARTANA MANHÃ" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: "D1",
                anchor: ClinicalAnchor.ACORDAR,
                offsetMinutes: 120,
                semanticTag: ClinicalSemanticTag.STANDARD,
              },
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
      medicationSnapshot: { commercialName: "ZOLPIDEM" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
        frequencies: [
          {
            frequency: 1,
            steps: [
              {
                doseLabel: "D1",
                anchor: ClinicalAnchor.DORMIR,
                offsetMinutes: 0,
                semanticTag: ClinicalSemanticTag.BEDTIME_SLOT,
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
      phases: [buildPhase({ frequency: 1 })],
    }),
  ];
}

export function buildCalciumPersistentConflictScenario() {
  return [
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "CALCIO" },
      protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
      phases: [buildPhase({ frequency: 2 })],
    }),
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "BLOQUEADOR 21" },
      interactionRulesSnapshot: [
        buildInteractionRule({
          interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
          targetGroupCode: GroupCode.GROUP_III_CALC,
          resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
        }),
      ],
      phases: [
        buildPhase({
          frequency: 1,
          manualAdjustmentEnabled: true,
          manualTimes: ["21:00"],
        }),
      ],
    }),
    buildPrescriptionMedication({
      medicationSnapshot: { commercialName: "BLOQUEADOR 22" },
      interactionRulesSnapshot: [
        buildInteractionRule({
          interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
          targetGroupCode: GroupCode.GROUP_III_CALC,
          resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
        }),
      ],
      phases: [
        buildPhase({
          frequency: 1,
          manualAdjustmentEnabled: true,
          manualTimes: ["22:00"],
        }),
      ],
    }),
  ];
}
