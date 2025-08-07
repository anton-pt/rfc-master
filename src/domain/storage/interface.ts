import { 
  RFC, 
  Comment, 
  ReviewRequest, 
  Agent, 
  RFCFilters,
  CommentStatus 
} from '../types';

export interface IStorage {
  rfcs: IRFCStorage;
  comments: ICommentStorage;
  reviews: IReviewStorage;
  agents: IAgentStorage;
}

export interface IRFCStorage {
  create(rfc: RFC): Promise<RFC>;
  update(rfc: RFC): Promise<RFC>;
  getById(id: string): Promise<RFC | null>;
  list(filters?: Partial<RFCFilters>): Promise<RFC[]>;
  getByVersion(id: string, version: number): Promise<RFC | null>;
}

export interface ICommentStorage {
  create(comment: Comment): Promise<Comment>;
  update(comment: Comment): Promise<Comment>;
  getById(id: string): Promise<Comment | null>;
  getByRFC(rfcId: string, status?: CommentStatus): Promise<Comment[]>;
  getByParent(parentCommentId: string): Promise<Comment[]>;
  getThread(commentId: string): Promise<Comment[]>;
}

export interface IReviewStorage {
  create(review: ReviewRequest): Promise<ReviewRequest>;
  update(review: ReviewRequest): Promise<ReviewRequest>;
  getById(id: string): Promise<ReviewRequest | null>;
  getByRFC(rfcId: string): Promise<ReviewRequest[]>;
  getActiveByRFC(rfcId: string): Promise<ReviewRequest | null>;
}

export interface IAgentStorage {
  create(agent: Agent): Promise<Agent>;
  getById(id: string): Promise<Agent | null>;
  list(): Promise<Agent[]>;
}