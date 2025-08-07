import { randomUUID } from 'crypto';
import {
  Comment,
  CommentStatus,
  CommentType,
  AddCommentParams,
  ReplyToCommentParams,
  TextReference
} from '../types';
import { IStorage } from '../storage/interface';

export class CommentService {
  constructor(private storage: IStorage) {}

  async addComment(params: AddCommentParams): Promise<Comment> {
    this.validateAddCommentParams(params);

    const rfc = await this.storage.rfcs.getById(params.rfcId);
    if (!rfc) {
      throw new Error(`RFC with id ${params.rfcId} not found`);
    }

    const agent = await this.storage.agents.getById(params.agentId);
    if (!agent) {
      throw new Error(`Agent with id ${params.agentId} not found`);
    }

    if (!agent.capabilities.canComment) {
      throw new Error(`Agent ${params.agentId} does not have permission to comment`);
    }

    let textReference: TextReference | undefined;
    if (params.commentType === CommentType.INLINE) {
      if (!params.quotedText) {
        throw new Error('Quoted text is required for inline comments');
      }

      const textExists = rfc.content.includes(params.quotedText);
      if (!textExists) {
        throw new Error(`Quoted text not found in RFC content`);
      }

      textReference = {
        quotedText: params.quotedText,
        lineNumber: params.lineReference,
        textSpan: params.textSpan
      };
    }

    const comment: Comment = {
      id: randomUUID(),
      rfcId: params.rfcId,
      rfcVersion: rfc.version,
      agentId: params.agentId,
      agentType: params.agentType,
      type: params.commentType,
      content: params.content,
      status: CommentStatus.OPEN,
      textReference,
      createdAt: new Date()
    };

    return await this.storage.comments.create(comment);
  }

  async replyToComment(params: ReplyToCommentParams): Promise<Comment> {
    this.validateReplyParams(params);

    const parentComment = await this.storage.comments.getById(params.parentCommentId);
    if (!parentComment) {
      throw new Error(`Parent comment with id ${params.parentCommentId} not found`);
    }

    const agent = await this.storage.agents.getById(params.agentId);
    if (!agent) {
      throw new Error(`Agent with id ${params.agentId} not found`);
    }

    if (!agent.capabilities.canComment) {
      throw new Error(`Agent ${params.agentId} does not have permission to comment`);
    }

    const reply: Comment = {
      id: randomUUID(),
      rfcId: parentComment.rfcId,
      rfcVersion: parentComment.rfcVersion,
      agentId: params.agentId,
      agentType: params.agentType,
      type: CommentType.DOCUMENT_LEVEL,
      content: params.content,
      status: CommentStatus.OPEN,
      parentCommentId: params.parentCommentId,
      createdAt: new Date()
    };

    return await this.storage.comments.create(reply);
  }

  async resolveComment(commentId: string, resolverId: string): Promise<Comment> {
    const comment = await this.storage.comments.getById(commentId);
    if (!comment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    if (comment.status !== CommentStatus.OPEN) {
      throw new Error(`Comment is already ${comment.status}`);
    }

    const resolver = await this.storage.agents.getById(resolverId);
    if (!resolver) {
      throw new Error(`Agent with id ${resolverId} not found`);
    }

    const resolvedComment: Comment = {
      ...comment,
      status: CommentStatus.RESOLVED,
      resolvedAt: new Date(),
      resolvedBy: resolverId
    };

    return await this.storage.comments.update(resolvedComment);
  }

  async dismissComment(commentId: string, dismisserId: string): Promise<Comment> {
    const comment = await this.storage.comments.getById(commentId);
    if (!comment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    if (comment.status !== CommentStatus.OPEN) {
      throw new Error(`Comment is already ${comment.status}`);
    }

    const dismisser = await this.storage.agents.getById(dismisserId);
    if (!dismisser) {
      throw new Error(`Agent with id ${dismisserId} not found`);
    }

    const dismissedComment: Comment = {
      ...comment,
      status: CommentStatus.DISMISSED,
      dismissedAt: new Date(),
      dismissedBy: dismisserId
    };

    return await this.storage.comments.update(dismissedComment);
  }

  async getCommentsForRFC(rfcId: string, status?: CommentStatus): Promise<Comment[]> {
    return await this.storage.comments.getByRFC(rfcId, status);
  }

  async getCommentThread(commentId: string): Promise<Comment[]> {
    const comment = await this.storage.comments.getById(commentId);
    if (!comment) {
      throw new Error(`Comment with id ${commentId} not found`);
    }

    return await this.storage.comments.getThread(commentId);
  }

  private validateAddCommentParams(params: AddCommentParams): void {
    if (!params.rfcId || params.rfcId.trim().length === 0) {
      throw new Error('RFC ID is required');
    }
    if (!params.agentId || params.agentId.trim().length === 0) {
      throw new Error('Agent ID is required');
    }
    if (!params.content || params.content.trim().length === 0) {
      throw new Error('Comment content is required');
    }
    if (!params.commentType) {
      throw new Error('Comment type is required');
    }
  }

  private validateReplyParams(params: ReplyToCommentParams): void {
    if (!params.parentCommentId || params.parentCommentId.trim().length === 0) {
      throw new Error('Parent comment ID is required');
    }
    if (!params.agentId || params.agentId.trim().length === 0) {
      throw new Error('Agent ID is required');
    }
    if (!params.content || params.content.trim().length === 0) {
      throw new Error('Reply content is required');
    }
  }
}