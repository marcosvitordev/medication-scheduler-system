import { ClinicalInteractionType } from '../src/common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../src/common/enums/clinical-resolution-type.enum';
import { DoseUnit } from '../src/common/enums/dose-unit.enum';
import { GroupCode } from '../src/common/enums/group-code.enum';
import { OcularLaterality } from '../src/common/enums/ocular-laterality.enum';
import { OticLaterality } from '../src/common/enums/otic-laterality.enum';
import { ScheduleStatus } from '../src/common/enums/schedule-status.enum';
import { TreatmentRecurrence } from '../src/common/enums/treatment-recurrence.enum';
import {
  buildInteractionRule,
  buildPhase,
  buildPrescriptionMedication,
  buildProtocolSnapshot,
  buildRoutine,
  buildScheduleResult,
  createSchedulingService,
} from './helpers/scheduling-test-helpers';

describe('SchedulingService final schedule JSON contract', () => {
  it('returns snake_case fields required by frontend/PDF with code+label metadata', async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'CONTRAVE',
          activePrinciple: 'Naltrexona 8 mg + Bupropiona 90 mg',
          presentation: 'Comprimido revestido de liberacao prolongada',
          pharmaceuticalForm: 'Comprimido',
          administrationRoute: 'Via oral',
          usageInstructions: 'Utilizar junto com as refeicoes.',
        },
        protocolSnapshot: buildProtocolSnapshot(GroupCode.GROUP_III, {
          code: 'GROUP_III_CONTRAVE',
          name: 'Contrave escalonado',
          description: 'Escalonamento em fases',
        }),
        phases: [
          buildPhase({
            phaseOrder: 1,
            frequency: 1,
            doseAmount: '1 COMP',
            doseValue: '1',
            doseUnit: DoseUnit.COMP,
            recurrenceType: TreatmentRecurrence.DAILY,
            treatmentDays: 7,
          }),
        ],
      }),
    ], { startedAt: '2026-02-20' });

    expect(result).toMatchObject({
      paciente_id: expect.any(String),
      prescricao_id: expect.any(String),
      medicamentos: expect.any(Array),
    });

    const medication = result.medicamentos[0];
    expect(medication).toMatchObject({
      nome_medicamento: 'CONTRAVE',
      principio_ativo: 'Naltrexona 8 mg + Bupropiona 90 mg',
      apresentacao: 'Comprimido revestido de liberacao prolongada',
      forma_farmaceutica: 'Comprimido',
      via_administracao: 'Via oral',
      orientacoes_uso: 'Utilizar junto com as refeicoes.',
      grupo_codigo: GroupCode.GROUP_III,
      grupo_label: expect.any(String),
      protocolo_codigo: 'GROUP_III_CONTRAVE',
      protocolo_nome: 'Contrave escalonado',
      protocolo_descricao: 'Escalonamento em fases',
    });

    const phase = medication.fases[0];
    expect(phase).toMatchObject({
      fase_ordem: 1,
      fase_label: 'Posologia 1',
      data_inicio: '20/02/2026',
      data_fim: '26/02/2026',
      uso_continuo: false,
      lateralidade_ocular_codigo: null,
      lateralidade_ocular_label: null,
      lateralidade_otologica_codigo: null,
      lateralidade_otologica_label: null,
      via_administracao_label: 'Via oral',
      entradas: expect.any(Array),
    });
    expect(phase.data_inicio).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(phase.data_fim).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

    const entry = phase.entradas[0];
    expect(entry).toMatchObject({
      dose_horario_label: 'D1',
      dose_valor: '1',
      dose_unidade: DoseUnit.COMP,
      dose_exibicao: '1 COMP',
      horario: '07:00',
      recorrencia_codigo: TreatmentRecurrence.DAILY,
      recorrencia_label: expect.any(String),
      lateralidade_ocular_codigo: null,
      lateralidade_ocular_label: null,
      lateralidade_otologica_codigo: null,
      lateralidade_otologica_label: null,
      via_administracao_label: 'Via oral',
      status_codigo: ScheduleStatus.ACTIVE,
      status_label: expect.any(String),
      observacao: null,
      conflito: null,
    });
  });

  it('returns data_fim as null when phase is uso_continuo', async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        phases: [
          buildPhase({
            phaseOrder: 1,
            frequency: 1,
            recurrenceType: TreatmentRecurrence.DAILY,
            continuousUse: true,
            treatmentDays: undefined,
          }),
        ],
      }),
    ], { startedAt: '2026-03-15' });

    expect(result.medicamentos[0].fases[0]).toMatchObject({
      data_inicio: '15/03/2026',
      data_fim: null,
      uso_continuo: true,
    });
  });

  it('returns conflict payload with snake_case keys and labels when conflict exists', async () => {
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

    const interactor = buildPrescriptionMedication({
      medicationSnapshot: {
        commercialName: 'LOSARTANA',
        activePrinciple: 'Losartana potassica',
        presentation: 'Comprimido',
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

    const result = await buildScheduleResult(service, [sucralfato, interactor]);
    const sucralfatoEntry = result.medicamentos
      .find((medication) => medication.nome_medicamento === 'SUCRAFILM')
      ?.fases[0]
      ?.entradas.find((entry) => entry.horario === '15:00');

    expect(sucralfatoEntry?.conflito).toMatchObject({
      tipo_interacao_codigo: ClinicalInteractionType.AFFECTED_BY_SUCRALFATE,
      tipo_interacao_label: expect.any(String),
      tipo_resolucao_codigo: ClinicalResolutionType.SHIFT_SOURCE_BY_WINDOW,
      tipo_resolucao_label: expect.any(String),
      medicamento_disparador_nome: 'LOSARTANA',
      grupo_disparador_codigo: GroupCode.GROUP_I,
      protocolo_disparador_codigo: expect.any(String),
      prioridade_regra: 100,
      janela_antes_minutos: 420,
      janela_depois_minutos: 420,
    });
  });

  it('returns ocular laterality labels for XALACOM-equivalent prescription', async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'XALACOM',
          activePrinciple: 'Latanoprosta + Maleato de timolol',
          presentation: 'Frasco 2,5 ml',
          administrationRoute: 'Via ocular',
          usageInstructions: 'Instilar uma gota ao dia.',
          isOphthalmic: true,
        },
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '1 GOTA',
            doseValue: '1',
            doseUnit: DoseUnit.GOTAS,
            recurrenceType: TreatmentRecurrence.DAILY,
            treatmentDays: 10,
            ocularLaterality: OcularLaterality.RIGHT_EYE,
          }),
        ],
      }),
    ]);

    const phase = result.medicamentos[0].fases[0];
    const entry = phase.entradas[0];
    expect(phase).toMatchObject({
      lateralidade_ocular_codigo: OcularLaterality.RIGHT_EYE,
      lateralidade_ocular_label: 'olho direito',
      lateralidade_otologica_codigo: null,
      lateralidade_otologica_label: null,
      via_administracao_label: 'Via ocular - olho direito',
    });
    expect(entry).toMatchObject({
      lateralidade_ocular_codigo: OcularLaterality.RIGHT_EYE,
      lateralidade_ocular_label: 'olho direito',
      lateralidade_otologica_codigo: null,
      lateralidade_otologica_label: null,
      via_administracao_label: 'Via ocular - olho direito',
    });
  });

  it('returns otic laterality labels for OTOCIRIAX-equivalent prescription', async () => {
    const { service } = createSchedulingService();
    const result = await buildScheduleResult(service, [
      buildPrescriptionMedication({
        medicationSnapshot: {
          commercialName: 'OTOCIRIAX',
          activePrinciple: 'Ciprofloxacino + Hidrocortisona',
          presentation: 'Frasco 10 ml',
          administrationRoute: 'Via otológica',
          usageInstructions: 'Instilar conforme orientação.',
          isOtic: true,
        },
        phases: [
          buildPhase({
            frequency: 1,
            doseAmount: '3 GOTAS',
            doseValue: '3',
            doseUnit: DoseUnit.GOTAS,
            recurrenceType: TreatmentRecurrence.DAILY,
            treatmentDays: 7,
            oticLaterality: OticLaterality.BOTH_EARS,
          }),
        ],
      }),
    ]);

    const phase = result.medicamentos[0].fases[0];
    const entry = phase.entradas[0];
    expect(phase).toMatchObject({
      lateralidade_ocular_codigo: null,
      lateralidade_ocular_label: null,
      lateralidade_otologica_codigo: OticLaterality.BOTH_EARS,
      lateralidade_otologica_label: 'nas 2 orelhas',
      via_administracao_label: 'Via otológica - nas 2 orelhas',
    });
    expect(entry).toMatchObject({
      lateralidade_ocular_codigo: null,
      lateralidade_ocular_label: null,
      lateralidade_otologica_codigo: OticLaterality.BOTH_EARS,
      lateralidade_otologica_label: 'nas 2 orelhas',
      via_administracao_label: 'Via otológica - nas 2 orelhas',
    });
  });
});
