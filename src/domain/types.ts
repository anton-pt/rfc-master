export enum RFCStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUPERSEDED = 'superseded'
}

export enum CommentStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed'
}

export enum CommentType {
  INLINE = 'inline',
  DOCUMENT_LEVEL = 'document_level'
}

export enum ReviewStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed'
}

export enum AgentType {
  LEAD = 'lead',
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  SECURITY = 'security',
  DATABASE = 'database',
  DEVOPS = 'devops'
}

export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: {
    canEdit: boolean;
    canComment: boolean;
    canApprove: boolean;
  };
  createdAt: Date;
}

export interface RFC {
  id: string;
  version: number;
  status: RFCStatus;
  title: string;
  content: string;
  author: string;
  requestingUser: string;
  createdAt: Date;
  updatedAt: Date;
  previousVersionId?: string;
}

export interface TextReference {
  quotedText: string;
  lineNumber?: number;
  sectionId?: string;
  textSpan?: {
    start: number;
    end: number;
  };
}

export interface Comment {
  id: string;
  rfcId: string;
  rfcVersion: number;
  agentId: string;
  agentType: AgentType;
  type: CommentType;
  content: string;
  status: CommentStatus;
  textReference?: TextReference;
  parentCommentId?: string;
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  dismissedAt?: Date;
  dismissedBy?: string;
}

export interface ReviewRequest {
  id: string;
  rfcId: string;
  rfcVersion: number;
  requestedBy: string;
  reviewerAgentIds: string[];
  reviewStatuses: Record<string, ReviewStatus>;
  deadline?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface ReviewSubmission {
  reviewRequestId: string;
  agentId: string;
  comments: Comment[];
  submittedAt: Date;
}

export interface RFCFilters {
  status?: RFCStatus;
  author?: string;
  requestingUser?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface CreateRFCParams {
  title: string;
  content: string;
  author: string;
  requestingUser: string;
}

export interface AddCommentParams {
  rfcId: string;
  agentId: string;
  agentType: AgentType;
  commentType: CommentType;
  content: string;
  quotedText?: string;
  lineReference?: number;
  textSpan?: { start: number; end: number };
}

export interface ReplyToCommentParams {
  parentCommentId: string;
  agentId: string;
  agentType: AgentType;
  content: string;
}

export interface RequestReviewParams {
  rfcId: string;
  requestedBy: string;
  reviewerAgentIds: string[];
  deadline?: Date;
}

export interface SubmitReviewParams {
  reviewRequestId: string;
  agentId: string;
  comments: Comment[];
}

export interface ReplaceStringParams {
  rfcId: string;
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}