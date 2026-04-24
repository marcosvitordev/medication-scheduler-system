import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalGroup } from './clinical-group.entity';
import { ClinicalMedication } from './clinical-medication.entity';
import { ClinicalProtocolFrequency } from './clinical-protocol-frequency.entity';
import { ClinicalInteractionRule } from './clinical-interaction-rule.entity';

@Entity('clinical_protocols')
export class ClinicalProtocol {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  subgroupCode?: string;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  clinicalNotes?: string;

  @ManyToOne(() => ClinicalMedication, (medication) => medication.protocols, {
    eager: false,
    onDelete: 'CASCADE',
  })
  medication: ClinicalMedication;

  @ManyToOne(() => ClinicalGroup, (group) => group.protocols, {
    eager: true,
    onDelete: 'RESTRICT',
  })
  group: ClinicalGroup;

  @OneToMany(() => ClinicalProtocolFrequency, (frequency) => frequency.protocol, {
    cascade: true,
    eager: true,
  })
  frequencies: ClinicalProtocolFrequency[];

  @OneToMany(() => ClinicalInteractionRule, (rule) => rule.protocol, {
    cascade: true,
    eager: true,
  })
  interactionRules: ClinicalInteractionRule[];
}
