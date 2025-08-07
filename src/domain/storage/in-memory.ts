import {
  RFC,
  Comment,
  ReviewRequest,
  Agent,
  RFCFilters,
  CommentStatus
} from '../types';
import {
  IStorage,
  IRFCStorage,
  ICommentStorage,
  IReviewStorage,
  IAgentStorage
} from './interface';

class InMemoryRFCStorage implements IRFCStorage {
  private rfcs: Map<string, RFC[]> = new Map();
  private latestVersions: Map<string, RFC> = new Map();

  async create(rfc: RFC): Promise<RFC> {
    const versions = this.rfcs.get(rfc.id) || [];
    versions.push(rfc);
    this.rfcs.set(rfc.id, versions);
    this.latestVersions.set(rfc.id, rfc);
    return rfc;
  }

  async update(rfc: RFC): Promise<RFC> {
    const versions = this.rfcs.get(rfc.id) || [];
    const existingIndex = versions.findIndex(v => v.version === rfc.version);
    
    if (existingIndex >= 0) {
      versions[existingIndex] = rfc;
    } else {
      versions.push(rfc);
    }
    
    this.rfcs.set(rfc.id, versions);
    
    const latestVersion = versions.reduce((latest, current) => 
      current.version > latest.version ? current : latest
    );
    this.latestVersions.set(rfc.id, latestVersion);
    
    return rfc;
  }

  async getById(id: string): Promise<RFC | null> {
    return this.latestVersions.get(id) || null;
  }

  async getByVersion(id: string, version: number): Promise<RFC | null> {
    const versions = this.rfcs.get(id) || [];
    return versions.find(v => v.version === version) || null;
  }

  async list(filters?: Partial<RFCFilters>): Promise<RFC[]> {
    let rfcs = Array.from(this.latestVersions.values());

    if (filters) {
      if (filters.status) {
        rfcs = rfcs.filter(rfc => rfc.status === filters.status);
      }
      if (filters.author) {
        rfcs = rfcs.filter(rfc => rfc.author === filters.author);
      }
      if (filters.requestingUser) {
        rfcs = rfcs.filter(rfc => rfc.requestingUser === filters.requestingUser);
      }
      if (filters.createdAfter) {
        rfcs = rfcs.filter(rfc => rfc.createdAt >= filters.createdAfter!);
      }
      if (filters.createdBefore) {
        rfcs = rfcs.filter(rfc => rfc.createdAt <= filters.createdBefore!);
      }
    }

    return rfcs;
  }
}

class InMemoryCommentStorage implements ICommentStorage {
  private comments: Map<string, Comment> = new Map();
  private rfcComments: Map<string, Set<string>> = new Map();
  private parentChildMap: Map<string, Set<string>> = new Map();

  async create(comment: Comment): Promise<Comment> {
    this.comments.set(comment.id, comment);
    
    const rfcCommentIds = this.rfcComments.get(comment.rfcId) || new Set();
    rfcCommentIds.add(comment.id);
    this.rfcComments.set(comment.rfcId, rfcCommentIds);
    
    if (comment.parentCommentId) {
      const children = this.parentChildMap.get(comment.parentCommentId) || new Set();
      children.add(comment.id);
      this.parentChildMap.set(comment.parentCommentId, children);
    }
    
    return comment;
  }

  async update(comment: Comment): Promise<Comment> {
    this.comments.set(comment.id, comment);
    return comment;
  }

  async getById(id: string): Promise<Comment | null> {
    return this.comments.get(id) || null;
  }

  async getByRFC(rfcId: string, status?: CommentStatus): Promise<Comment[]> {
    const commentIds = this.rfcComments.get(rfcId) || new Set();
    let comments = Array.from(commentIds)
      .map(id => this.comments.get(id))
      .filter((c): c is Comment => c !== undefined);

    if (status) {
      comments = comments.filter(c => c.status === status);
    }

    return comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getByParent(parentCommentId: string): Promise<Comment[]> {
    const childIds = this.parentChildMap.get(parentCommentId) || new Set();
    return Array.from(childIds)
      .map(id => this.comments.get(id))
      .filter((c): c is Comment => c !== undefined)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getThread(commentId: string): Promise<Comment[]> {
    const thread: Comment[] = [];
    const visited = new Set<string>();
    
    const buildThread = async (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const comment = await this.getById(id);
      if (!comment) return;
      
      if (comment.parentCommentId && !visited.has(comment.parentCommentId)) {
        await buildThread(comment.parentCommentId);
      }
      
      thread.push(comment);
      
      const children = await this.getByParent(id);
      for (const child of children) {
        await buildThread(child.id);
      }
    };
    
    await buildThread(commentId);
    return thread;
  }
}

class InMemoryReviewStorage implements IReviewStorage {
  private reviews: Map<string, ReviewRequest> = new Map();
  private rfcReviews: Map<string, Set<string>> = new Map();

  async create(review: ReviewRequest): Promise<ReviewRequest> {
    this.reviews.set(review.id, review);
    
    const rfcReviewIds = this.rfcReviews.get(review.rfcId) || new Set();
    rfcReviewIds.add(review.id);
    this.rfcReviews.set(review.rfcId, rfcReviewIds);
    
    return review;
  }

  async update(review: ReviewRequest): Promise<ReviewRequest> {
    this.reviews.set(review.id, review);
    return review;
  }

  async getById(id: string): Promise<ReviewRequest | null> {
    return this.reviews.get(id) || null;
  }

  async getByRFC(rfcId: string): Promise<ReviewRequest[]> {
    const reviewIds = this.rfcReviews.get(rfcId) || new Set();
    return Array.from(reviewIds)
      .map(id => this.reviews.get(id))
      .filter((r): r is ReviewRequest => r !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getActiveByRFC(rfcId: string): Promise<ReviewRequest | null> {
    const reviews = await this.getByRFC(rfcId);
    return reviews.find(r => !r.completedAt) || null;
  }
}

class InMemoryAgentStorage implements IAgentStorage {
  private agents: Map<string, Agent> = new Map();

  async create(agent: Agent): Promise<Agent> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async getById(id: string): Promise<Agent | null> {
    return this.agents.get(id) || null;
  }

  async list(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }
}

export class InMemoryStorage implements IStorage {
  rfcs: IRFCStorage;
  comments: ICommentStorage;
  reviews: IReviewStorage;
  agents: IAgentStorage;

  constructor() {
    this.rfcs = new InMemoryRFCStorage();
    this.comments = new InMemoryCommentStorage();
    this.reviews = new InMemoryReviewStorage();
    this.agents = new InMemoryAgentStorage();
  }
}