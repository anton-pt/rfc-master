import { randomUUID } from 'crypto';
import { Agent, AgentType } from '../types';
import { IStorage } from '../storage/interface';

export class AgentService {
  constructor(private storage: IStorage) {}

  async createAgent(
    type: AgentType,
    name: string,
    capabilities?: Partial<Agent['capabilities']>
  ): Promise<Agent> {
    if (!name || name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    const defaultCapabilities = this.getDefaultCapabilities(type);
    const agent: Agent = {
      id: randomUUID(),
      type,
      name,
      capabilities: {
        ...defaultCapabilities,
        ...capabilities
      },
      createdAt: new Date()
    };

    return await this.storage.agents.create(agent);
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return await this.storage.agents.getById(agentId);
  }

  async listAgents(): Promise<Agent[]> {
    return await this.storage.agents.list();
  }

  private getDefaultCapabilities(type: AgentType): Agent['capabilities'] {
    switch (type) {
      case AgentType.LEAD:
        return {
          canEdit: true,
          canComment: true,
          canApprove: true
        };
      case AgentType.FRONTEND:
      case AgentType.BACKEND:
      case AgentType.SECURITY:
      case AgentType.DATABASE:
      case AgentType.DEVOPS:
        return {
          canEdit: false,
          canComment: true,
          canApprove: false
        };
      default:
        return {
          canEdit: false,
          canComment: true,
          canApprove: false
        };
    }
  }
}