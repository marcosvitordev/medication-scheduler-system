import { ClinicalAnchor } from "../src/common/enums/clinical-anchor.enum";
import { ClinicalInteractionType } from "../src/common/enums/clinical-interaction-type.enum";
import { ClinicalResolutionType } from "../src/common/enums/clinical-resolution-type.enum";
import { ClinicalSemanticTag } from "../src/common/enums/clinical-semantic-tag.enum";
import { ConflictMatchKind } from "../src/common/enums/conflict-match-kind.enum";
import { ConflictReasonCode } from "../src/common/enums/conflict-reason-code.enum";
import { DoseUnit } from "../src/common/enums/dose-unit.enum";
import { GroupCode } from "../src/common/enums/group-code.enum";
import { MonthlySpecialReference } from "../src/common/enums/monthly-special-reference.enum";
import { OcularLaterality } from "../src/common/enums/ocular-laterality.enum";
import { PrnReason } from "../src/common/enums/prn-reason.enum";
import { ScheduleStatus } from "../src/common/enums/schedule-status.enum";
import { TreatmentRecurrence } from "../src/common/enums/treatment-recurrence.enum";
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
} from "./helpers/scheduling-test-helpers";
import { calculateMonthlySpecialReferenceDate } from "../src/modules/scheduling/scheduling.service";

describe("SchedulingService final calendar JSON contract", () => {
  it("returns the top-level blocks required by the frontend/PDF", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: "CONTRAVE",
            activePrinciple: "Naltrexona 8 mg + Bupropiona 90 mg",
            presentation: "Comprimido revestido de liberacao prolongada",
            pharmaceuticalForm: "Comprimido",
            administrationRoute: "Via oral",
            usageInstructions: "Utilizar junto com as refeicoes.",
          },
          protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
            code: "GROUP_III_CONTRAVE",
          }),
          phases: [
            buildPhase({
              phaseOrder: 1,
              frequency: 1,
              doseAmount: "1 COMP",
              doseValue: "1",
              doseUnit: DoseUnit.COMP,
              recurrenceType: TreatmentRecurrence.DAILY,
              treatmentDays: 7,
            }),
          ],
        }),
      ],
      { startedAt: "2026-02-20" },
    );

    expect(result).toMatchObject({
      prescriptionId: expect.any(String),
      documentHeader: {
        nomeEmpresa: "AT Farma",
        cnpj: "12.345.678/0001-90",
        telefone: "(68)3333-4444",
        email: "contato@atfarma.com.br",
        farmaceuticoNome: "Farmacêutica Teste",
        farmaceuticoCrf: "CRF-AC 1234",
      },
      patient: {
        id: expect.any(String),
        nome: "Paciente Teste",
        dataNascimento: "01/01/1970",
        idade: expect.any(Number),
        rg: "RG-TESTE",
        cpf: "000.000.000-00",
        telefone: "(68)99999-9999",
      },
      routine: {
        acordar: "06:00",
        cafe: "07:00",
        almoco: "12:00",
        lanche: "15:00",
        jantar: "19:00",
        dormir: "22:00",
      },
      scheduleItems: expect.any(Array),
    });

    expect(result.scheduleItems[0]).toMatchObject({
      prescriptionMedicationId: expect.any(String),
      phaseId: expect.any(String),
      medicamento: "CONTRAVE",
      principioAtivo: "Naltrexona 8 mg + Bupropiona 90 mg",
      apresentacao: "Comprimido revestido de liberacao prolongada",
      formaFarmaceutica: "Comprimido",
      via: "Via oral",
      modoUso: "Utilizar junto com as refeicoes.",
      recorrenciaTexto: "Diário",
      inicio: "20/02/2026",
      termino: "26/02/2026",
      status: "Ativo",
      observacoes: [],
      doses: [
        {
          label: "D1",
          horario: "07:00",
          doseValor: "1",
          doseUnidade: DoseUnit.COMP,
          doseExibicao: "1 COMP",
          status: ScheduleStatus.ACTIVE,
          statusLabel: "Ativo",
          observacao: null,
        },
      ],
    });
  });

  it("keeps one schedule item per clinically distinct phase block", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: "CONTRAVE",
            activePrinciple: "Naltrexona 8 mg + Bupropiona 90 mg",
          },
          phases: [
            buildPhase({ phaseOrder: 1, frequency: 1, treatmentDays: 7 }),
            buildPhase({ phaseOrder: 2, frequency: 2, treatmentDays: 7 }),
          ],
        }),
      ],
      { startedAt: "2026-02-20" },
    );

    expect(result.scheduleItems).toHaveLength(2);
    expect(
      result.scheduleItems.map((item) => item.prescriptionMedicationId),
    ).toEqual([
      result.scheduleItems[0].prescriptionMedicationId,
      result.scheduleItems[0].prescriptionMedicationId,
    ]);
    expect(result.scheduleItems[0]).toMatchObject({
      recorrenciaTexto: "Diário",
      inicio: "20/02/2026",
      termino: "26/02/2026",
    });
    expect(result.scheduleItems[1]).toMatchObject({
      recorrenciaTexto: "Diário",
      inicio: "27/02/2026",
      termino: "05/03/2026",
    });
    expect(result.scheduleItems[1].doses).toHaveLength(2);
  });

  it("maps recurrence text for weekly, monthly, alternate-days and PRN treatments", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "A" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.WEEKLY,
            weeklyDay: "SEGUNDA",
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "B" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.MONTHLY,
            monthlyDay: 5,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "C" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.ALTERNATE_DAYS,
            alternateDaysInterval: 2,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "D" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.PRN,
            prnReason: PrnReason.PAIN,
            treatmentDays: undefined,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "E" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.MONTHLY,
            monthlyDay: undefined,
            monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
            monthlySpecialBaseDate: "2026-04-01",
            monthlySpecialOffsetDays: 5,
          }),
        ],
      }),
    ]);

    expect(
      result.scheduleItems.map((item) => [
        item.medicamento,
        item.recorrenciaTexto,
      ]),
    ).toEqual([
      ["A", "Semanal: segunda-feira"],
      ["B", "Mensal: dia 05"],
      ["C", "A cada 2 dias"],
      ["D", "Em caso de dor"],
      [
        "E",
        "Primeira aplicação: 5º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.",
      ],
    ]);
  });

  it("calculates monthly special dates as inclusive clinical ordinal days", () => {
    expect(calculateMonthlySpecialReferenceDate("2026-04-01", 8)).toBe(
      "2026-04-08",
    );
    expect(calculateMonthlySpecialReferenceDate("2026-04-01", 5)).toBe(
      "2026-04-05",
    );
    expect(calculateMonthlySpecialReferenceDate("2026-02-25", 8)).toBe(
      "2026-03-04",
    );
  });

  it("keeps the monthly contraceptive ordinal rule in the final calendar JSON", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "PERLUTAN" },
        phases: [
          buildPhase({
            phaseOrder: 1,
            recurrenceType: TreatmentRecurrence.MONTHLY,
            monthlyDay: undefined,
            monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
            monthlySpecialBaseDate: "2026-04-01",
            monthlySpecialOffsetDays: 8,
          }),
        ],
      }),
    ]);

    expect(result.scheduleItems[0]).toMatchObject({
      medicamento: "PERLUTAN",
      recorrenciaTexto:
        "Primeira aplicação: 8º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.",
    });
  });

  it("supports per-dose amounts in the final contract", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
          frequencies: [
            {
              frequency: 2,
              steps: [
                {
                  doseLabel: "D1",
                  anchor: ClinicalAnchor.CAFE,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
                {
                  doseLabel: "D2",
                  anchor: ClinicalAnchor.JANTAR,
                  offsetMinutes: 0,
                  semanticTag: ClinicalSemanticTag.STANDARD,
                },
              ],
            },
          ],
        }),
        phases: [
          buildPhase({
            frequency: 2,
            sameDosePerSchedule: false,
            perDoseOverrides: [
              { doseLabel: "D1", doseValue: "1", doseUnit: DoseUnit.COMP },
              { doseLabel: "D2", doseValue: "2", doseUnit: DoseUnit.COMP },
            ],
          }),
        ],
      }),
    ]);

    expect(result.scheduleItems[0].doses).toMatchObject([
      {
        label: "D1",
        doseValor: "1",
        doseUnidade: DoseUnit.COMP,
        doseExibicao: "1 COMP",
      },
      {
        label: "D2",
        doseValor: "2",
        doseUnidade: DoseUnit.COMP,
        doseExibicao: "2 COMP",
      },
    ]);
  });

  it("keeps 24:00 and exposes routine/patient data in the final contract", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-04-22T10:00:00"));
    try {
      const { service } = createSchedulingService({
        routine: buildRoutine({
          acordar: "06:00",
          cafe: "06:00",
          almoco: "12:00",
          lanche: "18:00",
          jantar: "18:00",
          dormir: "24:00",
        }),
      });

      const result = await buildScheduleResult(
        service,
        [
          buildPrescriptionMedication({
            protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I, {
              frequencies: [
                {
                  frequency: 4,
                  steps: [
                    {
                      doseLabel: "D1",
                      anchor: ClinicalAnchor.ACORDAR,
                      offsetMinutes: 0,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                    {
                      doseLabel: "D2",
                      anchor: ClinicalAnchor.ACORDAR,
                      offsetMinutes: 360,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                    {
                      doseLabel: "D3",
                      anchor: ClinicalAnchor.ACORDAR,
                      offsetMinutes: 720,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                    {
                      doseLabel: "D4",
                      anchor: ClinicalAnchor.ACORDAR,
                      offsetMinutes: 1080,
                      semanticTag: ClinicalSemanticTag.STANDARD,
                    },
                  ],
                },
              ],
            }),
            phases: [buildPhase({ frequency: 4 })],
          }),
        ],
        { startedAt: "2026-04-17" },
      );

      expect(result.patient).toMatchObject({
        nome: "Paciente Teste",
        dataNascimento: "01/01/1970",
        idade: 56,
      });
      expect(result.routine.dormir).toBe("24:00");
      expect(result.scheduleItems[0].doses.map((dose) => dose.horario)).toEqual(
        ["06:00", "12:00", "18:00", "24:00"],
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("reflects ocular laterality in via/modo de uso and keeps optional patient fields nullable", async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(
      service,
      [
        buildPrescriptionMedication({
          medicationSnapshot: {
            commercialName: "COLÍRIO TESTE",
            activePrinciple: "Cloreto de sódio",
            administrationRoute: "Via ocular",
            usageInstructions: "Pingar conforme orientacao.",
          },
          phases: [
            buildPhase({
              ocularLaterality: OcularLaterality.RIGHT_EYE,
            }),
          ],
        }),
      ],
      {
        patient: {
          id: "patient-optional-null",
          fullName: "Paciente Sem Documento",
          birthDate: "1980-07-05",
          rg: undefined,
          cpf: undefined,
          phone: undefined,
          routines: [],
          prescriptions: [],
        } as never,
      },
    );

    expect(result.patient).toMatchObject({
      nome: "Paciente Sem Documento",
      dataNascimento: "05/07/1980",
      rg: null,
      cpf: null,
      telefone: null,
    });
    expect(result.scheduleItems[0]).toMatchObject({
      via: "Via ocular - olho direito",
      modoUso: "Pingar conforme orientacao. Aplicar no olho direito.",
    });
  });

  it("enforces the documented five-minute interval between ophthalmic drops", async () => {
    const { service } = createSchedulingService({
      routine: buildRoutine({
        acordar: "06:00",
        cafe: "07:00",
        almoco: "12:00",
        lanche: "15:00",
        jantar: "19:00",
        dormir: "21:00",
      }),
    });

    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: "XALACOM",
          activePrinciple: "Latanoprosta + Timolol",
          administrationRoute: "Via ocular",
          usageInstructions: "Aplicar 1 gota à noite.",
          isOphthalmic: true,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
          code: "DELTA_OCULAR_BEDTIME",
        }),
        phases: [
          buildPhase({
            frequency: 1,
            doseValue: "1",
            doseUnit: DoseUnit.GOTAS,
            ocularLaterality: OcularLaterality.RIGHT_EYE,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: "OUTRO COLIRIO",
          activePrinciple: "Brimonidina",
          administrationRoute: "Via ocular",
          usageInstructions: "Aplicar 1 gota à noite.",
          isOphthalmic: true,
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_DELTA, {
          code: "DELTA_OCULAR_BEDTIME",
        }),
        phases: [
          buildPhase({
            frequency: 1,
            doseValue: "1",
            doseUnit: DoseUnit.GOTAS,
            ocularLaterality: OcularLaterality.LEFT_EYE,
          }),
        ],
      }),
    ]);

    const xalacom = result.scheduleItems.find((item) => item.medicamento === "XALACOM");
    const otherEyeDrop = result.scheduleItems.find((item) => item.medicamento === "OUTRO COLIRIO");
    const allEyeDropDoses = [xalacom, otherEyeDrop].flatMap((item) => item?.doses ?? []);
    const shiftedDose = allEyeDropDoses.find(
      (dose) => dose.reasonCode === ConflictReasonCode.SHIFTED_BY_OPHTHALMIC_INTERVAL,
    );

    expect(xalacom).toMatchObject({
      via: "Via ocular - olho direito",
    });
    expect(otherEyeDrop).toMatchObject({
      via: "Via ocular - olho esquerdo",
    });
    expect(allEyeDropDoses.map((dose) => dose.horario).sort()).toEqual(["21:00", "21:05"]);
    expect(shiftedDose).toMatchObject({
      horario: "21:05",
      status: ScheduleStatus.ACTIVE,
      reasonText: expect.stringContaining("intervalo mínimo de 5 minutos entre colírios"),
      conflito: expect.objectContaining({
        tipo_interacao_codigo: ClinicalInteractionType.OPHTHALMIC_MIN_INTERVAL,
        tipo_match_codigo: ConflictMatchKind.EXACT_MINUTE,
        janela_antes_minutos: 4,
        janela_depois_minutos: 4,
      }),
    });
  });

  it("exposes dose time context and conflict metadata for frontend rendering/debug", async () => {
    const { service } = createSchedulingService({
      routine: buildRoutine({
        acordar: "06:00",
        cafe: "07:00",
        almoco: "12:00",
        lanche: "15:00",
        jantar: "19:00",
        dormir: "21:00",
      }),
    });

    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "CALCIO" },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III_CALC),
        phases: [buildPhase({ frequency: 2 })],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "MEDICAMENTO 21" },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            targetGroupCode: GroupCode.GROUP_III_CALC,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ["21:00"],
            treatmentDays: 10,
          }),
        ],
      }),
      buildPrescriptionMedication({
        medicationSnapshot: { commercialName: "MEDICAMENTO 22" },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_I),
        interactionRulesSnapshot: [
          buildInteractionRule({
            interactionType: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
            resolutionType: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
            targetGroupCode: GroupCode.GROUP_III_CALC,
            targetProtocolCode: undefined,
          }),
        ],
        phases: [
          buildPhase({
            frequency: 1,
            manualAdjustmentEnabled: true,
            manualTimes: ["22:00"],
            treatmentDays: 10,
          }),
        ],
      }),
    ]);

    const calciumAtNight = result.scheduleItems
      .flatMap((item) => item.doses)
      .find((dose) => dose.horario === "22:00");

    expect(calciumAtNight).toMatchObject({
      reasonCode: ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
      reasonText: expect.stringContaining("revalidação"),
      contextoHorario: {
        ancora: ClinicalAnchor.DORMIR,
        horario_original: "21:00",
        horario_resolvido: "22:00",
      },
      conflito: {
        tipo_interacao_codigo: ClinicalInteractionType.AFFECTED_BY_CALCIUM,
        tipo_resolucao_codigo: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
        tipo_match_codigo: ConflictMatchKind.EXACT_MINUTE,
      },
    });
  });
});
