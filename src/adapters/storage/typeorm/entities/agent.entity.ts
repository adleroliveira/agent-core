import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, JoinColumn } from 'typeorm';
import { StateEntity } from './state.entity';
import { ToolEntity } from './tool.entity';

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

  @OneToOne(() => StateEntity, { cascade: true })
  @JoinColumn()
  state: StateEntity;

  @OneToMany(() => ToolEntity, tool => tool.agent, { cascade: true })
  tools: ToolEntity[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}