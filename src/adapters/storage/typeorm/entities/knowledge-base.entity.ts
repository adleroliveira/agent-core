import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { AgentEntity } from "./agent.entity";

@Entity("knowledge_bases")
export class KnowledgeBaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "agent_id" })
  agentId: string;

  @ManyToOne(() => AgentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent: AgentEntity;

  @Column()
  name: string;

  @Column({ nullable: true })
  description?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
} 