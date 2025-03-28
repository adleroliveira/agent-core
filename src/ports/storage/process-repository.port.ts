import { Process, ProcessStatus } from '@core/domain/process.entity';

export interface ProcessRepositoryPort {
  findById(id: string): Promise<Process | null>;
  findAll(): Promise<Process[]>;
  findByStatus(status: ProcessStatus): Promise<Process[]>;
  save(process: Process): Promise<Process>;
  delete(id: string): Promise<boolean>;
  exists(id: string): Promise<boolean>;
} 