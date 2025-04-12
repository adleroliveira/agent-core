import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { AgentEntity } from "./agent.entity";
import { MessageEntity } from "./message.entity";

@Entity("states")
export class StateEntity {
  @PrimaryColumn("uuid")
  id: string;

  @ManyToOne(() => AgentEntity, (agent) => agent.states, { onDelete: 'CASCADE' })
  @JoinColumn({ name: "agentId" })
  agent: AgentEntity;

  @Column()
  agentId: string;

  @Column({ type: "text", nullable: true })
  title: string | null;

  @OneToMany(() => MessageEntity, (message) => message.state)
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
