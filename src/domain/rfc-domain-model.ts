import { IStorage } from './storage/interface';
import { InMemoryStorage } from './storage/in-memory';
import { RFCService } from './services/rfc-service';
import { CommentService } from './services/comment-service';
import { ReviewService } from './services/review-service';
import { AgentService } from './services/agent-service';
import {
  RFC,
  Comment,
  ReviewRequest,
  Agent,
  RFCStatus,
  CommentStatus,
  ReviewStatus,
  AddCommentParams,
  ReplyToCommentParams,
  RequestReviewParams,
  SubmitReviewParams,
  ReplaceStringParams,
  RFCFilters
} from './types';

export class RFCDomainModel {
  private storage: IStorage;
  private rfcService: RFCService;
  private commentService: CommentService;
  private reviewService: ReviewService;
  private agentService: AgentService;

  constructor(storage?: IStorage) {
    this.storage = storage || new InMemoryStorage();
    this.rfcService = new RFCService(this.storage);
    this.commentService = new CommentService(this.storage);
    this.reviewService = new ReviewService(this.storage);
    this.agentService = new AgentService(this.storage);
  }

  async createRFC(title: string, content: string, author: string, requestingUser: string): Promise<RFC> {
    return await this.rfcService.createRFC({
      title,
      content,
      author,
      requestingUser
    });
  }

  async updateRFCContent(rfcId: string, content: string): Promise<RFC> {
    return await this.rfcService.updateRFCContent(rfcId, content);
  }

  async updateRFCStatus(rfcId: string, status: RFCStatus): Promise<RFC> {
    return await this.rfcService.updateRFCStatus(rfcId, status);
  }

  async getRFC(rfcId: string): Promise<RFC | null> {
    return await this.rfcService.getRFC(rfcId);
  }

  async listRFCs(filters?: Partial<RFCFilters>): Promise<RFC[]> {
    return await this.rfcService.listRFCs(filters);
  }

  async addComment(params: AddCommentParams): Promise<Comment> {
    return await this.commentService.addComment(params);
  }

  async replyToComment(params: ReplyToCommentParams): Promise<Comment> {
    return await this.commentService.replyToComment(params);
  }

  async resolveComment(commentId: string, resolverId: string): Promise<Comment> {
    return await this.commentService.resolveComment(commentId, resolverId);
  }

  async dismissComment(commentId: string, dismisserId: string): Promise<Comment> {
    return await this.commentService.dismissComment(commentId, dismisserId);
  }

  async getCommentsForRFC(rfcId: string, status?: CommentStatus): Promise<Comment[]> {
    return await this.commentService.getCommentsForRFC(rfcId, status);
  }

  async getCommentThread(commentId: string): Promise<Comment[]> {
    return await this.commentService.getCommentThread(commentId);
  }

  async requestReview(params: RequestReviewParams): Promise<ReviewRequest> {
    return await this.reviewService.requestReview(params);
  }

  async submitReview(params: SubmitReviewParams): Promise<void> {
    return await this.reviewService.submitReview(params);
  }

  async getReviewStatus(reviewRequestId: string): Promise<Record<string, ReviewStatus>> {
    return await this.reviewService.getReviewStatus(reviewRequestId);
  }

  async isReviewComplete(reviewRequestId: string): Promise<boolean> {
    return await this.reviewService.isReviewComplete(reviewRequestId);
  }

  async getActiveReviewForRFC(rfcId: string): Promise<ReviewRequest | null> {
    return await this.reviewService.getActiveReviewForRFC(rfcId);
  }

  async addReviewersToActiveReview(rfcId: string, newReviewerIds: string[]): Promise<ReviewRequest> {
    return await this.reviewService.addReviewersToActiveReview(rfcId, newReviewerIds);
  }

  async replaceString(params: ReplaceStringParams): Promise<RFC> {
    return await this.rfcService.replaceString(params);
  }

  async validateStringExists(rfcId: string, text: string): Promise<boolean> {
    return await this.rfcService.validateStringExists(rfcId, text);
  }

  async createAgent(type: Agent['type'], name: string, capabilities?: Partial<Agent['capabilities']>): Promise<Agent> {
    return await this.agentService.createAgent(type, name, capabilities);
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return await this.agentService.getAgent(agentId);
  }

  async listAgents(): Promise<Agent[]> {
    return await this.agentService.listAgents();
  }
}

export * from './types';