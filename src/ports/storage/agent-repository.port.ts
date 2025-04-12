import { Agent } from '@core/domain/agent.entity';

export interface AgentRepositoryPort {
  findById(id: string, loadRelations?: boolean): Promise<Agent | null>;
  findAll(loadRelations?: boolean): Promise<Agent[]>;
  save(agent: Agent): Promise<Agent>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
}