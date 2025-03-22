import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from "typeorm";
import { AgentEntity } from "./agent.entity";
import { MessageEntity } from "./message.entity";

@Entity("states")
export class StateEntity {
  @PrimaryColumn("uuid")
  id: string;

  @Column({ nullable: true })
  agentId: string;

  @Column({ nullable: true })
  conversationId: string;

  @OneToOne(() => AgentEntity, (agent) => agent.state)
  agent: AgentEntity;

  @OneToMany(() => MessageEntity, (message) => message.state, { cascade: true })
  messages: MessageEntity[];

  @Column("json", { default: "{}" })
  memory: Record<string, any>;

  @Column({ nullable: true })
  ttl: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
