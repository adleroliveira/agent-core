import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { AgentEntity } from './agent.entity';

@Entity('knowledge_bases')
export class KnowledgeBaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('uuid', { name: 'agent_id' })
  agentId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToOne(() => AgentEntity, agent => agent.knowledgeBase)
  @JoinColumn({ name: 'agent_id' })
  agent: AgentEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 