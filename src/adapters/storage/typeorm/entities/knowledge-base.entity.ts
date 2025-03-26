import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { AgentEntity } from './agent.entity';

@Entity('knowledge_bases')
export class KnowledgeBaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  agentId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToOne(() => AgentEntity, agent => agent.knowledgeBase)
  @JoinColumn({ name: 'agentId' })
  agent: AgentEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 