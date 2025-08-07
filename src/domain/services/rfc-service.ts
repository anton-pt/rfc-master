import { randomUUID } from 'crypto';
import {
  RFC,
  RFCStatus,
  RFCFilters,
  CreateRFCParams,
  ReplaceStringParams
} from '../types';
import { IStorage } from '../storage/interface';

export class RFCService {
  constructor(private storage: IStorage) {}

  async createRFC(params: CreateRFCParams): Promise<RFC> {
    this.validateCreateParams(params);

    const rfc: RFC = {
      id: randomUUID(),
      version: 1,
      status: RFCStatus.DRAFT,
      title: params.title,
      content: params.content,
      author: params.author,
      requestingUser: params.requestingUser,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return await this.storage.rfcs.create(rfc);
  }

  async updateRFCContent(rfcId: string, content: string): Promise<RFC> {
    const existingRFC = await this.storage.rfcs.getById(rfcId);
    if (!existingRFC) {
      throw new Error(`RFC with id ${rfcId} not found`);
    }

    const newVersion: RFC = {
      ...existingRFC,
      version: existingRFC.version + 1,
      content,
      updatedAt: new Date(),
      previousVersionId: `${existingRFC.id}-v${existingRFC.version}`
    };

    return await this.storage.rfcs.update(newVersion);
  }

  async updateRFCStatus(rfcId: string, status: RFCStatus): Promise<RFC> {
    const existingRFC = await this.storage.rfcs.getById(rfcId);
    if (!existingRFC) {
      throw new Error(`RFC with id ${rfcId} not found`);
    }

    this.validateStatusTransition(existingRFC.status, status);

    const updatedRFC: RFC = {
      ...existingRFC,
      status,
      updatedAt: new Date()
    };

    return await this.storage.rfcs.update(updatedRFC);
  }

  async getRFC(rfcId: string): Promise<RFC | null> {
    return await this.storage.rfcs.getById(rfcId);
  }

  async getRFCVersion(rfcId: string, version: number): Promise<RFC | null> {
    return await this.storage.rfcs.getByVersion(rfcId, version);
  }

  async listRFCs(filters?: Partial<RFCFilters>): Promise<RFC[]> {
    return await this.storage.rfcs.list(filters);
  }

  async replaceString(params: ReplaceStringParams): Promise<RFC> {
    const rfc = await this.storage.rfcs.getById(params.rfcId);
    if (!rfc) {
      throw new Error(`RFC with id ${params.rfcId} not found`);
    }

    const exists = await this.validateStringExists(params.rfcId, params.oldText);
    if (!exists) {
      throw new Error(`String "${params.oldText}" not found in RFC content`);
    }

    let newContent = rfc.content;
    if (params.replaceAll) {
      newContent = rfc.content.split(params.oldText).join(params.newText);
    } else {
      const index = rfc.content.indexOf(params.oldText);
      if (index !== -1) {
        newContent = 
          rfc.content.substring(0, index) + 
          params.newText + 
          rfc.content.substring(index + params.oldText.length);
      }
    }

    return await this.updateRFCContent(params.rfcId, newContent);
  }

  async validateStringExists(rfcId: string, text: string): Promise<boolean> {
    const rfc = await this.storage.rfcs.getById(rfcId);
    if (!rfc) {
      return false;
    }
    return rfc.content.includes(text);
  }

  private validateCreateParams(params: CreateRFCParams): void {
    if (!params.title || params.title.trim().length === 0) {
      throw new Error('RFC title is required');
    }
    if (!params.content || params.content.trim().length === 0) {
      throw new Error('RFC content is required');
    }
    if (!params.author || params.author.trim().length === 0) {
      throw new Error('RFC author is required');
    }
    if (!params.requestingUser || params.requestingUser.trim().length === 0) {
      throw new Error('Requesting user is required');
    }
  }

  private validateStatusTransition(currentStatus: RFCStatus, newStatus: RFCStatus): void {
    const validTransitions: Record<RFCStatus, RFCStatus[]> = {
      [RFCStatus.DRAFT]: [RFCStatus.IN_REVIEW, RFCStatus.REJECTED],
      [RFCStatus.IN_REVIEW]: [RFCStatus.APPROVED, RFCStatus.REJECTED, RFCStatus.DRAFT],
      [RFCStatus.APPROVED]: [RFCStatus.SUPERSEDED],
      [RFCStatus.REJECTED]: [RFCStatus.DRAFT],
      [RFCStatus.SUPERSEDED]: []
    };

    const allowedTransitions = validTransitions[currentStatus];
    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }
  }
}