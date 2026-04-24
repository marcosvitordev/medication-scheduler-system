import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ClinicalProtocol } from './clinical-protocol.entity';

@Entity('clinical_groups')
export class ClinicalGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @OneToMany(() => ClinicalProtocol, (protocol) => protocol.group)
  protocols: ClinicalProtocol[];
}
