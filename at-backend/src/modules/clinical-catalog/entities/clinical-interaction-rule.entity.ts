import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalInteractionType } from '../../../common/enums/clinical-interaction-type.enum';
import { ClinicalResolutionType } from '../../../common/enums/clinical-resolution-type.enum';
import { ClinicalSemanticTag } from '../../../common/enums/clinical-semantic-tag.enum';
import { ClinicalProtocol } from './clinical-protocol.entity';

@Entity('clinical_interaction_rules')
export class ClinicalInteractionRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ClinicalProtocol, (protocol) => protocol.interactionRules, {
    onDelete: 'CASCADE',
    orphanedRowAction: 'delete',
  })
  protocol: ClinicalProtocol;

  @Column({ type: 'varchar', length: 40 })
  interactionType: ClinicalInteractionType;

  @Column({ nullable: true })
  targetGroupCode?: string;

  @Column({ nullable: true })
  targetProtocolCode?: string;

  @Column({ type: 'varchar', length: 50 })
  resolutionType: ClinicalResolutionType;

  @Column({ type: 'int', nullable: true })
  windowMinutes?: number;

  @Column({ type: 'int', nullable: true })
  windowBeforeMinutes?: number;

  @Column({ type: 'int', nullable: true })
  windowAfterMinutes?: number;

  @Column({ type: 'simple-array', nullable: true })
  applicableSemanticTags?: ClinicalSemanticTag[];

  @Column({ type: 'int', default: 0 })
  priority: number;
}
