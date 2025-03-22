import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { AgentEntity } from './agent.entity';

@Entity('tools')
export class ToolEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('json')
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
    enum?: any[];
    default?: any;
  }>;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  agentId: string;

  @ManyToOne(() => AgentEntity, agent => agent.tools)
  @JoinColumn({ name: 'agentId' })
  agent: AgentEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}