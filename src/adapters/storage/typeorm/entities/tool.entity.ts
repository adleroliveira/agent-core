import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Tool, ToolParameter } from "@core/domain/tool.entity";

@Entity("tools")
export class ToolEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @Column({ type: "json" })
  parameters: ToolParameter[];

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @Column({ type: "json", nullable: true })
  jsonSchema: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}