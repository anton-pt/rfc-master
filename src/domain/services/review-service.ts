import { randomUUID } from 'crypto';
import {
  ReviewRequest,
  ReviewStatus,
  RequestReviewParams,
  SubmitReviewParams
} from '../types';
import { IStorage } from '../storage/interface';

export class ReviewService {
  constructor(private storage: IStorage) {}

  async requestReview(params: RequestReviewParams): Promise<ReviewRequest> {
    this.validateRequestParams(params);

    const rfc = await this.storage.rfcs.getById(params.rfcId);
    if (!rfc) {
      throw new Error(`RFC with id ${params.rfcId} not found`);
    }

    const activeReview = await this.storage.reviews.getActiveByRFC(params.rfcId);
    if (activeReview) {
      throw new Error(`RFC ${params.rfcId} already has an active review request`);
    }

    for (const reviewerId of params.reviewerAgentIds) {
      const agent = await this.storage.agents.getById(reviewerId);
      if (!agent) {
        throw new Error(`Reviewer agent with id ${reviewerId} not found`);
      }
      if (!agent.capabilities.canComment) {
        throw new Error(`Agent ${reviewerId} does not have permission to review`);
      }
    }

    const reviewStatuses: Record<string, ReviewStatus> = {};
    for (const reviewerId of params.reviewerAgentIds) {
      reviewStatuses[reviewerId] = ReviewStatus.PENDING;
    }

    const reviewRequest: ReviewRequest = {
      id: randomUUID(),
      rfcId: params.rfcId,
      rfcVersion: rfc.version,
      requestedBy: params.requestedBy,
      reviewerAgentIds: params.reviewerAgentIds,
      reviewStatuses,
      deadline: params.deadline,
      createdAt: new Date()
    };

    return await this.storage.reviews.create(reviewRequest);
  }

  async submitReview(params: SubmitReviewParams): Promise<void> {
    this.validateSubmitParams(params);

    const reviewRequest = await this.storage.reviews.getById(params.reviewRequestId);
    if (!reviewRequest) {
      throw new Error(`Review request with id ${params.reviewRequestId} not found`);
    }

    if (reviewRequest.completedAt) {
      throw new Error(`Review request ${params.reviewRequestId} is already completed`);
    }

    if (!reviewRequest.reviewerAgentIds.includes(params.agentId)) {
      throw new Error(`Agent ${params.agentId} is not a reviewer for this request`);
    }

    const currentStatus = reviewRequest.reviewStatuses[params.agentId];
    if (currentStatus === ReviewStatus.COMPLETED) {
      throw new Error(`Agent ${params.agentId} has already submitted their review`);
    }

    if (reviewRequest.deadline && new Date() > reviewRequest.deadline) {
      throw new Error(`Review deadline has passed`);
    }

    for (const comment of params.comments) {
      if (comment.rfcId !== reviewRequest.rfcId) {
        throw new Error(`Comment ${comment.id} is not for the RFC being reviewed`);
      }
      await this.storage.comments.create(comment);
    }

    reviewRequest.reviewStatuses[params.agentId] = ReviewStatus.COMPLETED;

    const allCompleted = Object.values(reviewRequest.reviewStatuses)
      .every(status => status === ReviewStatus.COMPLETED);

    if (allCompleted) {
      reviewRequest.completedAt = new Date();
    }

    await this.storage.reviews.update(reviewRequest);
  }

  async getReviewStatus(reviewRequestId: string): Promise<Record<string, ReviewStatus>> {
    const reviewRequest = await this.storage.reviews.getById(reviewRequestId);
    if (!reviewRequest) {
      throw new Error(`Review request with id ${reviewRequestId} not found`);
    }

    return reviewRequest.reviewStatuses;
  }

  async isReviewComplete(reviewRequestId: string): Promise<boolean> {
    const reviewRequest = await this.storage.reviews.getById(reviewRequestId);
    if (!reviewRequest) {
      throw new Error(`Review request with id ${reviewRequestId} not found`);
    }

    return !!reviewRequest.completedAt;
  }

  async markReviewInProgress(reviewRequestId: string, agentId: string): Promise<void> {
    const reviewRequest = await this.storage.reviews.getById(reviewRequestId);
    if (!reviewRequest) {
      throw new Error(`Review request with id ${reviewRequestId} not found`);
    }

    if (!reviewRequest.reviewerAgentIds.includes(agentId)) {
      throw new Error(`Agent ${agentId} is not a reviewer for this request`);
    }

    const currentStatus = reviewRequest.reviewStatuses[agentId];
    if (currentStatus === ReviewStatus.COMPLETED) {
      throw new Error(`Agent ${agentId} has already completed their review`);
    }

    reviewRequest.reviewStatuses[agentId] = ReviewStatus.IN_PROGRESS;
    await this.storage.reviews.update(reviewRequest);
  }

  async getActiveReviewForRFC(rfcId: string): Promise<ReviewRequest | null> {
    return await this.storage.reviews.getActiveByRFC(rfcId);
  }

  async getAllReviewsForRFC(rfcId: string): Promise<ReviewRequest[]> {
    return await this.storage.reviews.getByRFC(rfcId);
  }

  async addReviewersToActiveReview(rfcId: string, newReviewerIds: string[]): Promise<ReviewRequest> {
    const activeReview = await this.storage.reviews.getActiveByRFC(rfcId);
    if (!activeReview) {
      throw new Error(`No active review found for RFC ${rfcId}`);
    }

    // Validate new reviewers exist and have permission
    for (const reviewerId of newReviewerIds) {
      if (!activeReview.reviewerAgentIds.includes(reviewerId)) {
        const agent = await this.storage.agents.getById(reviewerId);
        if (!agent) {
          throw new Error(`Reviewer agent with id ${reviewerId} not found`);
        }
        if (!agent.capabilities.canComment) {
          throw new Error(`Agent ${reviewerId} does not have permission to review`);
        }

        // Add to reviewers list and set status to pending
        activeReview.reviewerAgentIds.push(reviewerId);
        activeReview.reviewStatuses[reviewerId] = ReviewStatus.PENDING;
      }
    }

    return await this.storage.reviews.update(activeReview);
  }

  private validateRequestParams(params: RequestReviewParams): void {
    if (!params.rfcId || params.rfcId.trim().length === 0) {
      throw new Error('RFC ID is required');
    }
    if (!params.requestedBy || params.requestedBy.trim().length === 0) {
      throw new Error('Requester ID is required');
    }
    if (!params.reviewerAgentIds || params.reviewerAgentIds.length === 0) {
      throw new Error('At least one reviewer is required');
    }
    if (params.deadline && params.deadline <= new Date()) {
      throw new Error('Review deadline must be in the future');
    }
  }

  private validateSubmitParams(params: SubmitReviewParams): void {
    if (!params.reviewRequestId || params.reviewRequestId.trim().length === 0) {
      throw new Error('Review request ID is required');
    }
    if (!params.agentId || params.agentId.trim().length === 0) {
      throw new Error('Agent ID is required');
    }
    if (!params.comments) {
      throw new Error('Comments array is required');
    }
  }
}