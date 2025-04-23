import { Entity, Column, PrimaryColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MCPServerEntity } from './mcp-server.entity';

@Entity('mcp_tools')
export class MCPToolEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column('json')
  inputSchema: Record<string, any>;

  @Column('uuid')
  serverId: string;

  @ManyToOne(() => MCPServerEntity, (server) => server.tools)
  @JoinColumn({ name: 'serverId' })
  server: MCPServerEntity;
} 