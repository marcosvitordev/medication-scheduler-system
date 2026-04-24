import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalAnchor } from '../../../common/enums/clinical-anchor.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { ClinicalProtocolFrequency } from './clinical-protocol-frequency.entity';

@Entity('clinical_protocol_steps')
export class ClinicalProtocolStep {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalProtocolFrequency, (frequencyConfig) => frequencyConfig.steps, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  @JoinColumn({ name: 'frequencyId' })
  frequencyConfig: ClinicalProtocolFrequency;

  @Column()
  doseLabel: string;

  @Column({ type: 'varchar', length: 30 })
  anchor: ClinicalAnchor;

  @Column({ type: 'int', default: 0 })
  offsetMinutes: number;

  @Column({ type: 'varchar', length: 40, default: ClinicalSemanticTag.STANDARD })
  semanticTag: ClinicalSemanticTag;
}
