import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from "typeorm";
import { StateEntity } from "./state.entity";

@Entity("messages")
export class MessageEntity {
  @PrimaryColumn("uuid")
  id: string;

  @Column()
  role: string;

  @Column({ type: "text" })
  content: string; // Store as JSON string if object

  @Column()
  conversationId: string;

  @Column({ type: "text", nullable: true })
  metadata: string | null; // Store as JSON string

  @Column({ type: "text", nullable: true })
  toolCalls: string | null; // Store as JSON string

  @Column({ type: "text", nullable: true })
  toolCallId: string | null;

  @Column({ type: "text", nullable: true })
  toolName: string | null;

  @Column({ default: false })
  isStreaming: boolean;

  @ManyToOne(() => StateEntity, (state) => state.messages)
  @JoinColumn({ name: "conversationId" })
  state: StateEntity;

  @CreateDateColumn()
  createdAt: Date;

  @VersionColumn()
  version: number;
}
