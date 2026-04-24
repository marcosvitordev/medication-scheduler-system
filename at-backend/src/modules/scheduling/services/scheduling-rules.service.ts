import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import {
  ClinicalProtocolSnapshot,
  ProtocolFrequencySnapshot,
} from '../../patient-prescriptions/entities/patient-prescription-snapshot.types';

@Injectable()
export class SchedulingRulesService {
  getFrequencyConfig(
    protocolSnapshot: ClinicalProtocolSnapshot,
    frequency: number,
  ): ProtocolFrequencySnapshot {
    const config = protocolSnapshot.frequencies.find(
      (item) => item.frequency === frequency,
    );
    if (!config) {
      throw new UnprocessableEntityException(
        `Fórmula não cadastrada para protocolo ${protocolSnapshot.code} e frequência ${frequency}.`,
      );
    }
    return config;
  }
}
