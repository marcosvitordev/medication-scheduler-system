import { ClinicalAnchor } from "../src/common/enums/clinical-anchor.enum";
import { ConflictMatchKind } from "../src/common/enums/conflict-match-kind.enum";
import { ConflictReasonCode } from "../src/common/enums/conflict-reason-code.enum";
import { ScheduleStatus } from "../src/common/enums/schedule-status.enum";
import {
  activeDose,
  buildAlendronatoWeekly,
  buildCalciumPersistentConflictScenario,
  buildDoralginaPrn6h,
  buildGenericGroupIIIThreeMeals,
  buildManualAdjustmentMedication,
  buildOtociriaxOtic,
  buildPerlutanMonthly,
  buildSaltConflictScenario,
  buildSucralfateConflictScenario,
  buildXalacomOcular,
  clientRoutine,
  doseTimes,
  expectTimeContext,
  item,
} from "./helpers/client-adherence-fixtures";
import {
  buildScheduleResult,
  createSchedulingService,
} from "./helpers/scheduling-test-helpers";

describe("Suite de aderência funcional ao cliente", () => {
  it("expõe a rotina válida no JSON final do calendário", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [
      buildGenericGroupIIIThreeMeals(),
    ]);

    expect(result.routine).toEqual({
      acordar: "06:00",
      cafe: "07:00",
      almoco: "13:00",
      lanche: "16:00",
      jantar: "19:00",
      dormir: "21:00",
      banho: "08:30",
    });
    expect(result.scheduleItems).toHaveLength(1);
  });

  it("cobre Grupo I frequência 4 e PRN 6/6h com DORALGINA", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [buildDoralginaPrn6h()]);

    const doralgina = item(result, "DORALGINA");
    expect(doralgina.recorrenciaTexto).toBe("Em caso de dor");
    expect(doralgina.inicio).toBe("17/04/2026");
    expect(doralgina.termino).toBe("22/04/2026");
    expect(doralgina.doses.map((dose) => dose.horario)).toEqual([
      "06:00",
      "12:00",
      "18:00",
      "24:00",
    ]);
    expect(doralgina.doses.map((dose) => dose.status)).toEqual([
      ScheduleStatus.ACTIVE,
      ScheduleStatus.ACTIVE,
      ScheduleStatus.ACTIVE,
      ScheduleStatus.ACTIVE,
    ]);
    expectTimeContext(doralgina.doses[0], ClinicalAnchor.ACORDAR, 0);
    expectTimeContext(doralgina.doses[1], ClinicalAnchor.ACORDAR, 360);
    expectTimeContext(doralgina.doses[2], ClinicalAnchor.ACORDAR, 720);
    expectTimeContext(doralgina.doses[3], ClinicalAnchor.ACORDAR, 1080);
  });

  it("cobre bifosfonato semanal em jejum com ALENDRONATO", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [buildAlendronatoWeekly()]);

    const alendronato = item(result, "ALENDRONATO");
    expect(alendronato.recorrenciaTexto).toBe("Semanal: segunda-feira");
    expect(doseTimes(result, "ALENDRONATO")).toEqual(["05:00"]);
    expectTimeContext(alendronato.doses[0], ClinicalAnchor.ACORDAR, -60);
  });

  it("cobre Grupo III genérico em CAFÉ + ALMOÇO + JANTAR", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [
      buildGenericGroupIIIThreeMeals(),
    ]);

    const groupIII = item(result, "MEDICAMENTO GRUPO III");
    expect(groupIII.recorrenciaTexto).toBe("Diário");
    expect(groupIII.modoUso).toContain("Administrar junto às refeições.");
    expect(doseTimes(result, "MEDICAMENTO GRUPO III")).toEqual([
      "07:00",
      "13:00",
      "19:00",
    ]);
    expectTimeContext(groupIII.doses[0], ClinicalAnchor.CAFE, 0);
    expectTimeContext(groupIII.doses[1], ClinicalAnchor.ALMOCO, 0);
    expectTimeContext(groupIII.doses[2], ClinicalAnchor.JANTAR, 0);
  });

  it("cobre ajuste manual operacional com horários preservados", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [
      buildManualAdjustmentMedication(),
    ]);

    const losartana = item(result, "LOSARTANA");
    expect(losartana.modoUso).toContain("Horários definidos manualmente.");
    expect(doseTimes(result, "LOSARTANA")).toEqual(["08:15", "20:45"]);
    expectTimeContext(losartana.doses[0], ClinicalAnchor.MANUAL, 0);
    expectTimeContext(losartana.doses[1], ClinicalAnchor.MANUAL, 0);
  });

  it("cobre colírio com lateralidade ocular no calendário final", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [buildXalacomOcular()]);

    const xalacom = item(result, "XALACOM");
    expect(xalacom.via).toBe("Via ocular - ambos os olhos");
    expect(xalacom.modoUso).toContain("Aplicar em ambos os olhos.");
    expect(xalacom.recorrenciaTexto).toBe("Uso contínuo");
    expect(doseTimes(result, "XALACOM")).toEqual(["21:00"]);
  });

  it("cobre otológico com lateralidade otológica no calendário final", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [buildOtociriaxOtic()]);

    const otociriax = item(result, "OTOCIRIAX");
    expect(otociriax.via).toBe("Via otológica - nas 2 orelhas");
    expect(otociriax.modoUso).toContain("Aplicar nas 2 orelhas.");
    expect(otociriax.recorrenciaTexto).toBe("Diário");
    expect(doseTimes(result, "OTOCIRIAX")).toEqual(["06:00", "18:00"]);
  });

  it("cobre mensal especial com PERLUTAN e ordinal clínico inclusivo", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, [buildPerlutanMonthly()]);

    const perlutan = item(result, "PERLUTAN");
    expect(perlutan.recorrenciaTexto).toBe(
      "Primeira aplicação: 8º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.",
    );
    expect(perlutan.via).toBe("IM");
    expect(doseTimes(result, "PERLUTAN")).toEqual(["06:00"]);
    expectTimeContext(perlutan.doses[0], ClinicalAnchor.ACORDAR, 0);
  });

  it("cobre conflito obrigatório com sais inativando GASTROGEL", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(service, buildSaltConflictScenario());

    expect(activeDose(result, "GASTROGEL", "09:00")).toBeDefined();
    const inactiveSalt = item(result, "GASTROGEL").doses.find(
      (dose) => dose.horario === "21:00",
    );
    expect(inactiveSalt).toMatchObject({
      status: ScheduleStatus.INACTIVE,
      reasonCode: ConflictReasonCode.INACTIVATED_BY_MANDATORY_RULE,
      conflito: expect.objectContaining({
        tipo_match_codigo: ConflictMatchKind.MANDATORY_INACTIVATION,
      }),
    });
  });

  it("cobre conflito com sucralfato deslocando dose e inativando dose ao dormir", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(
      service,
      buildSucralfateConflictScenario(),
    );

    expect(item(result, "SUCRAFILM").doses.find((dose) => dose.horario === "15:00")).toMatchObject({
      status: ScheduleStatus.ACTIVE,
      reasonCode: ConflictReasonCode.SHIFTED_BY_WINDOW_CONFLICT,
    });
    expect(item(result, "SUCRAFILM").doses.find((dose) => dose.horario === "21:00")).toMatchObject({
      status: ScheduleStatus.INACTIVE,
      conflito: expect.objectContaining({
        tipo_match_codigo: ConflictMatchKind.MANDATORY_INACTIVATION,
      }),
    });
  });

  it("cobre conflito persistente com cálcio exigindo ajuste manual", async () => {
    const { service } = createSchedulingService({ routine: clientRoutine });
    const result = await buildScheduleResult(
      service,
      buildCalciumPersistentConflictScenario(),
    );

    expect(activeDose(result, "CALCIO", "10:00")).toBeDefined();
    expect(item(result, "CALCIO").doses.find((dose) => dose.horario === "22:00")).toMatchObject({
      status: ScheduleStatus.MANUAL_ADJUSTMENT_REQUIRED,
      reasonCode: ConflictReasonCode.MANUAL_REQUIRED_PERSISTENT_CONFLICT,
    });
  });
});
