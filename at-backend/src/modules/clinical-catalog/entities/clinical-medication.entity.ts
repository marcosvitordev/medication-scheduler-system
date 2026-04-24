import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { DoseUnit } from '../../../common/enums/dose-unit.enum';
import { ClinicalProtocol } from './clinical-protocol.entity';

@Entity('clinical_medications')
export class ClinicalMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  commercialName?: string;

  @Column()
  activePrinciple: string;

  @Column()
  presentation: string;

  @Column({ nullable: true })
  pharmaceuticalForm?: string;

  @Column()
  administrationRoute: string;

  @Column({ type: 'text' })
  usageInstructions: string;

  @Column({ nullable: true })
  diluentType?: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  defaultAdministrationUnit?: DoseUnit;

  @Column({ default: false })
  supportsManualAdjustment: boolean;

  @Column({ default: false })
  isOphthalmic: boolean;

  @Column({ default: false })
  isOtic: boolean;

  @Column({ default: false })
  isContraceptiveMonthly: boolean;

  @Column({ default: false })
  requiresGlycemiaScale: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ default: false })
  isDefault: boolean;

  @OneToMany(() => ClinicalProtocol, (protocol) => protocol.medication, {
    cascade: true,
    eager: true,
  })
  protocols: ClinicalProtocol[];
}
