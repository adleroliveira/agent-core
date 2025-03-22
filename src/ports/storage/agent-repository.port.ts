import { Agent } from '@core/domain/agent.entity';

export interface AgentRepositoryPort {
  findById(id: string): Promise<Agent | null>;
  findAll(): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}