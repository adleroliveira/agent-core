import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { AgentEntity } from "./agent.entity";
import { ToolEntity } from "./tool.entity";

@Entity("agent_tools")
export class AgentToolEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "agent_id" })
  agentId: string;

  @Column({ name: "tool_id" })
  toolId: string;

  @ManyToOne(() => AgentEntity, agent => agent.agentTools, { onDelete: "CASCADE" })
  @JoinColumn({ name: "agent_id" })
  agent: AgentEntity;

  @ManyToOne(() => ToolEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tool_id" })
  tool: ToolEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
} 