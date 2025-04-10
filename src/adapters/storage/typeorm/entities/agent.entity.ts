import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { StateEntity } from './state.entity';
import { ToolEntity } from './tool.entity';
import { KnowledgeBaseEntity } from './knowledge-base.entity';
import { AgentToolEntity } from './agent-tool.entity';

@Entity('agents')
export class AgentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  modelId: string;

  @Column('json')
  systemPrompt: {
    id: string;
    content: string;
    type: string;
    name?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  };

  @Column('json', { default: '{"workspaceDir": "./workspace"}' })
  workspaceConfig: { workspaceDir: string };

  @OneToMany(() => StateEntity, state => state.agent)
  states: StateEntity[];

  @OneToMany(() => AgentToolEntity, agentTool => agentTool.agent, { cascade: true })
  agentTools: AgentToolEntity[];

  @OneToOne(() => KnowledgeBaseEntity, knowledgeBase => knowledgeBase.agent, { 
    cascade: true, 
    onDelete: "CASCADE", 
    nullable: true 
  })
  knowledgeBase: KnowledgeBaseEntity | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}