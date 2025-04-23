import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { MCPToolEntity } from './mcp-tool.entity';

@Entity('mcp_servers')
export class MCPServerEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  provider: string;

  @Column()
  repository: string;

  @Column()
  name: string;

  @Column()
  command: string;

  @Column('simple-array')
  args: string[];

  @Column('text')
  env: string;

  @Column({ nullable: true })
  description?: string;

  @OneToMany(() => MCPToolEntity, (tool) => tool.server)
  tools: MCPToolEntity[];
} 