import { GroupCode } from "../../src/common/enums/group-code.enum";
import { ClinicalCatalogService } from "../../src/modules/clinical-catalog/clinical-catalog.service";
import { ClinicalGroup } from "../../src/modules/clinical-catalog/entities/clinical-group.entity";
import { ClinicalInteractionRule } from "../../src/modules/clinical-catalog/entities/clinical-interaction-rule.entity";
import { ClinicalMedication } from "../../src/modules/clinical-catalog/entities/clinical-medication.entity";
import { ClinicalProtocolFrequency } from "../../src/modules/clinical-catalog/entities/clinical-protocol-frequency.entity";
import { ClinicalProtocol } from "../../src/modules/clinical-catalog/entities/clinical-protocol.entity";
import { ClinicalProtocolStep } from "../../src/modules/clinical-catalog/entities/clinical-protocol-step.entity";

type SeededCatalogFixture = {
  medications: ClinicalMedication[];
  findMedicationByName: (commercialName: string) => ClinicalMedication;
  findMedicationById: (id: string) => ClinicalMedication;
  findProtocol: (commercialName: string, protocolCode: string) => ClinicalProtocol;
};

export async function buildSeededClinicalCatalog(): Promise<SeededCatalogFixture> {
  let sequence = 0;
  const nextId = (prefix: string) => `${prefix}-${++sequence}`;
  const medications: ClinicalMedication[] = [];
  const groups = Object.values(GroupCode).map(
    (code) =>
      ({
        id: `${code}-id`,
        code,
        name: code,
        description: code,
      }) as ClinicalGroup,
  );

  const assignIds = (medication: ClinicalMedication): ClinicalMedication => {
    medication.id = medication.id ?? nextId("clinical-medication");
    medication.protocols = (medication.protocols ?? []).map((protocol) => {
      protocol.id = protocol.id ?? nextId("clinical-protocol");
      protocol.frequencies = (protocol.frequencies ?? []).map((frequency) => {
        frequency.id = frequency.id ?? nextId("clinical-frequency");
        frequency.steps = (frequency.steps ?? []).map((step) => {
          step.id = step.id ?? nextId("clinical-step");
          return step as ClinicalProtocolStep;
        });
        return frequency as ClinicalProtocolFrequency;
      });
      protocol.interactionRules = (protocol.interactionRules ?? []).map(
        (rule) => {
          rule.id = rule.id ?? nextId("clinical-rule");
          return rule as ClinicalInteractionRule;
        },
      );
      return protocol as ClinicalProtocol;
    });
    return medication;
  };

  const medicationRepository = {
    create: jest.fn((entity) => assignIds(entity as ClinicalMedication)),
    save: jest.fn(async (entity) => {
      const persisted = assignIds(entity as ClinicalMedication);
      const existingIndex = medications.findIndex(
        (item) => item.id === persisted.id,
      );
      if (existingIndex >= 0) {
        medications[existingIndex] = persisted;
      } else {
        medications.push(persisted);
      }
      return persisted;
    }),
    find: jest.fn(async () => medications),
    findOne: jest.fn(),
  };

  const groupRepository = {
    create: jest.fn((entity) => entity),
    save: jest.fn(async (entity) => entity),
    find: jest.fn(async () => groups),
  };

  const service = new ClinicalCatalogService(
    medicationRepository as never,
    groupRepository as never,
  );
  await service.seedCatalog();

  const findMedicationByName = (commercialName: string): ClinicalMedication => {
    const medication = medications.find(
      (item) => item.commercialName === commercialName,
    );
    expect(medication).toBeDefined();
    return medication as ClinicalMedication;
  };

  const findMedicationById = (id: string): ClinicalMedication => {
    const medication = medications.find((item) => item.id === id);
    expect(medication).toBeDefined();
    return medication as ClinicalMedication;
  };

  const findProtocol = (
    commercialName: string,
    protocolCode: string,
  ): ClinicalProtocol => {
    const medication = findMedicationByName(commercialName);
    const protocol = medication.protocols.find(
      (item) => item.code === protocolCode,
    );
    expect(protocol).toBeDefined();
    return protocol as ClinicalProtocol;
  };

  return {
    medications,
    findMedicationByName,
    findMedicationById,
    findProtocol,
  };
}
