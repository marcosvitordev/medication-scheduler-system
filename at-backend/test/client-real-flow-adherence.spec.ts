import "reflect-metadata";
import { ClinicalAnchor } from "../src/common/enums/clinical-anchor.enum";
import { DoseUnit } from "../src/common/enums/dose-unit.enum";
import { MonthlySpecialReference } from "../src/common/enums/monthly-special-reference.enum";
import { OcularLaterality } from "../src/common/enums/ocular-laterality.enum";
import { OticLaterality } from "../src/common/enums/otic-laterality.enum";
import { PrnReason } from "../src/common/enums/prn-reason.enum";
import { ScheduleStatus } from "../src/common/enums/schedule-status.enum";
import { TreatmentRecurrence } from "../src/common/enums/treatment-recurrence.enum";
import { PatientPrescription } from "../src/modules/patient-prescriptions/entities/patient-prescription.entity";
import { PatientPrescriptionService } from "../src/modules/patient-prescriptions/patient-prescription.service";
import {
  clientRoutine,
  doseTimes,
  expectTimeContext,
  item,
} from "./helpers/client-adherence-fixtures";
import { buildSeededClinicalCatalog } from "./helpers/clinical-catalog-seed-fixtures";
import { createSchedulingService } from "./helpers/scheduling-test-helpers";

describe("Fluxo real de aderência funcional via catálogo seedado", () => {
  async function createHarness() {
    const catalog = await buildSeededClinicalCatalog();
    const { service: schedulingService, scheduledDoseRepository } =
      createSchedulingService({ routine: clientRoutine });
    let sequence = 0;
    let loadedPrescription: PatientPrescription | undefined;
    const nextId = (prefix: string) => `${prefix}-${++sequence}`;

    const phaseRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: entity.id ?? nextId("phase"),
      })),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const phaseDoseRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: entity.id ?? nextId("phase-dose"),
      })),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    const medicationRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: entity.id ?? nextId("prescription-medication"),
        phases: (entity.phases ?? []).map((phase) => ({
          ...phase,
          id: phase.id ?? nextId("phase"),
        })),
      })),
    };

    const prescriptionRepository = {
      create: jest.fn((entity) => ({
        ...entity,
        id: entity.id ?? nextId("prescription"),
      })),
      save: jest.fn(async (entity) => {
        loadedPrescription = {
          ...entity,
          id: entity.id ?? nextId("prescription"),
          medications: entity.medications.map((medication) => ({
            ...medication,
            id: medication.id ?? nextId("prescription-medication"),
            phases: medication.phases.map((phase) => ({
              ...phase,
              id: phase.id ?? nextId("phase"),
            })),
          })),
        } as PatientPrescription;
        return loadedPrescription;
      }),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        loadedPrescription?.id === where.id ? loadedPrescription : null,
      ),
    };

    const manager = {
      getRepository: jest.fn((entity) => {
        const entityName = typeof entity === "function" ? entity.name : String(entity);
        if (entityName === "PatientPrescription") return prescriptionRepository;
        if (entityName === "PatientPrescriptionMedication") return medicationRepository;
        if (entityName === "PatientPrescriptionPhase") return phaseRepository;
        if (entityName === "PatientPrescriptionPhaseDose") return phaseDoseRepository;
        if (entityName === "ScheduledDose") return scheduledDoseRepository;
        return {};
      }),
    };

    const patientService = {
      findById: jest.fn(async (id: string) => ({
        id,
        fullName: "Paciente Cliente",
        birthDate: "1970-01-01",
        rg: "RG-CLIENTE",
        cpf: "000.000.000-00",
        phone: "(68)99999-9999",
      })),
    };

    const service = new PatientPrescriptionService(
      {} as never,
      { transaction: jest.fn(async (callback) => callback(manager)) } as never,
      patientService as never,
      {
        findMedicationById: jest.fn(async (id: string) =>
          catalog.findMedicationById(id),
        ),
      } as never,
      schedulingService,
    );

    const createFromSeed = async (
      commercialName: string,
      protocolCode: string,
      phases: Array<Record<string, unknown>>,
      startedAt = "2026-04-17",
    ) => {
      const medication = catalog.findMedicationByName(commercialName);
      const protocol = catalog.findProtocol(commercialName, protocolCode);
      return service.create({
        patientId: "patient-1",
        startedAt,
        medications: [
          {
            clinicalMedicationId: medication.id,
            protocolId: protocol.id,
            phases: phases as never[],
          },
        ],
      });
    };

    return { createFromSeed };
  }

  function buildPhasePayload(overrides: Record<string, unknown> = {}) {
    return {
      phaseOrder: 1,
      frequency: 1,
      sameDosePerSchedule: true,
      doseAmount: "1 COMP",
      doseValue: "1",
      doseUnit: DoseUnit.COMP,
      recurrenceType: TreatmentRecurrence.DAILY,
      treatmentDays: 10,
      continuousUse: false,
      manualAdjustmentEnabled: false,
      ...overrides,
    };
  }

  it("aceita ALENDRONATO semanal pelo protocolo real e gera ACORDAR - 1H", async () => {
    const { createFromSeed } = await createHarness();

    const result = await createFromSeed("ALENDRONATO", "GROUP_II_BIFOS_STANDARD", [
      buildPhasePayload({
        frequency: 1,
        recurrenceType: TreatmentRecurrence.WEEKLY,
        weeklyDay: "SEGUNDA",
        treatmentDays: 30,
      }),
    ]);

    const alendronato = item(result, "ALENDRONATO");
    expect(alendronato.recorrenciaTexto).toBe("Semanal: segunda-feira");
    expect(doseTimes(result, "ALENDRONATO")).toEqual(["05:00"]);
    expectTimeContext(alendronato.doses[0], ClinicalAnchor.ACORDAR, -60);
  });

  it("aceita DORALGINA PRN 6/6h por 6 dias pelo protocolo real", async () => {
    const { createFromSeed } = await createHarness();

    const result = await createFromSeed("DORALGINA", "GROUP_I_DORALGINA_6H", [
      buildPhasePayload({
        frequency: 4,
        recurrenceType: TreatmentRecurrence.PRN,
        prnReason: PrnReason.PAIN,
        treatmentDays: 6,
      }),
    ]);

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
  });

  it("aceita Grupo III genérico seedado em café, almoço e jantar", async () => {
    const { createFromSeed } = await createHarness();

    const result = await createFromSeed(
      "MEDICAMENTO GRUPO III",
      "GROUP_III_CAFE_STANDARD",
      [
        buildPhasePayload({
          frequency: 3,
        }),
      ],
    );

    const groupIII = item(result, "MEDICAMENTO GRUPO III");
    expect(groupIII.recorrenciaTexto).toBe("Diário");
    expect(doseTimes(result, "MEDICAMENTO GRUPO III")).toEqual([
      "07:00",
      "13:00",
      "19:00",
    ]);
    expectTimeContext(groupIII.doses[0], ClinicalAnchor.CAFE, 0);
    expectTimeContext(groupIII.doses[1], ClinicalAnchor.ALMOCO, 0);
    expectTimeContext(groupIII.doses[2], ClinicalAnchor.JANTAR, 0);
  });

  it("aceita XALACOM e OTOCIRIAX seedados com lateralidade", async () => {
    const { createFromSeed } = await createHarness();

    const xalacomResult = await createFromSeed("XALACOM", "DELTA_OCULAR_BEDTIME", [
      buildPhasePayload({
        doseAmount: "1 GOTA",
        doseValue: "1",
        doseUnit: DoseUnit.GOTAS,
        continuousUse: true,
        treatmentDays: undefined,
        ocularLaterality: OcularLaterality.BOTH_EYES,
      }),
    ]);
    const otociriaxResult = await createFromSeed("OTOCIRIAX", "DELTA_OTICO_12H", [
      buildPhasePayload({
        frequency: 2,
        doseAmount: "3 GOTAS",
        doseValue: "3",
        doseUnit: DoseUnit.GOTAS,
        treatmentDays: 7,
        oticLaterality: OticLaterality.BOTH_EARS,
      }),
    ]);

    expect(item(xalacomResult, "XALACOM")).toMatchObject({
      via: "Via ocular - ambos os olhos",
      recorrenciaTexto: "Uso contínuo",
    });
    expect(item(xalacomResult, "XALACOM").modoUso).toContain(
      "Aplicar em ambos os olhos.",
    );
    expect(doseTimes(xalacomResult, "XALACOM")).toEqual(["21:00"]);

    expect(item(otociriaxResult, "OTOCIRIAX")).toMatchObject({
      via: "Via otológica - nas 2 orelhas",
      recorrenciaTexto: "Diário",
    });
    expect(item(otociriaxResult, "OTOCIRIAX").modoUso).toContain(
      "Aplicar nas 2 orelhas.",
    );
    expect(doseTimes(otociriaxResult, "OTOCIRIAX")).toEqual(["06:00", "18:00"]);
  });

  it("aceita PERLUTAN mensal especial seedado com ordinal inclusivo", async () => {
    const { createFromSeed } = await createHarness();

    const result = await createFromSeed("PERLUTAN", "DELTA_PERLUTAN_MONTHLY", [
      buildPhasePayload({
        doseAmount: "1 ML",
        doseValue: "1",
        doseUnit: DoseUnit.ML,
        recurrenceType: TreatmentRecurrence.MONTHLY,
        monthlyDay: undefined,
        monthlySpecialReference: MonthlySpecialReference.MENSTRUATION_START,
        monthlySpecialBaseDate: "2026-04-01",
        monthlySpecialOffsetDays: 8,
        treatmentDays: 30,
      }),
    ]);

    const perlutan = item(result, "PERLUTAN");
    expect(perlutan.recorrenciaTexto).toBe(
      "Primeira aplicação: 8º dia após início da menstruação. Demais aplicações: mensal no mesmo dia do mês.",
    );
    expect(perlutan.via).toBe("IM");
    expect(doseTimes(result, "PERLUTAN")).toEqual(["06:00"]);
    expectTimeContext(perlutan.doses[0], ClinicalAnchor.ACORDAR, 0);
  });
});
