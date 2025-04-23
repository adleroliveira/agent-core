import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { AgentEntity } from "./agent.entity";
import { MCPToolEntity } from "./mcp-tool.entity";

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

  @ManyToOne(() => MCPToolEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tool_id" })
  tool: MCPToolEntity;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
} 