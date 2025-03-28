import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProcessStatus } from '@core/domain/process.entity';

@Entity('processes')
export class ProcessEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  command: string;

  @Column({
    type: 'text',
    enum: ProcessStatus,
    default: ProcessStatus.PENDING
  })
  status: ProcessStatus;

  @Column({ type: 'text', nullable: true })
  output: string;

  @Column({ type: 'text', nullable: true })
  error: string;

  @Column({ nullable: true })
  exitCode: number;

  @Column({ type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', default: '{}' })
  metadata: Record<string, any>;

  @Column({ type: 'text', default: '{}' })
  env: Record<string, string>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 