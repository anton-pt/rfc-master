# RFC Master - Lead Agent Tools Implementation

A comprehensive RFC (Request for Comments) authoring system with AI agent tools for structured document management and collaborative review workflows.

## Overview

This project implements a multi-agent RFC authoring system consisting of:

1. **Domain Model**: Core business logic for RFC documents, comments, reviews, and agents
2. **Lead Agent Tools**: Vercel AI SDK tools for LLM-powered RFC management  
3. **Template System**: Structured RFC document generation
4. **Review Workflows**: Multi-agent collaborative review processes

## Architecture

```
src/
├── domain/                 # Core business logic
│   ├── types.ts           # TypeScript definitions
│   ├── rfc-domain-model.ts # Main domain model
│   ├── services/          # Business logic services
│   └── storage/           # Data persistence abstractions
├── tools/                 # AI agent tools
│   ├── lead-agent-tools.ts # Vercel AI SDK tools
│   ├── rfc-template.ts    # RFC document templates
│   └── __tests__/         # Tool tests
└── examples/              # Usage demonstrations
```

## Features

### Domain Model Capabilities

- **RFC Document Management**: Create, version, and track RFC documents
- **Comment System**: Inline and document-level comments with threading
- **Review Workflows**: Multi-agent review coordination and status tracking
- **Agent Management**: Role-based agent capabilities and permissions
- **String Operations**: Precise text replacement and content updates

### Lead Agent Tools

Ten comprehensive tools for AI agents:

1. **createRFCDocument** - Generate structured RFC documents
2. **updateRFCContent** - Replace specific text in documents
3. **addSection** - Insert new sections with proper positioning
4. **requestReview** - Coordinate reviews with specialized agents
5. **getReviewComments** - Retrieve and filter reviewer feedback
6. **resolveComment** - Mark comments resolved with explanations
7. **addLeadComment** - Add categorized lead agent comments
8. **searchCodebase** - Find relevant code context (mock implementation)
9. **analyzeImpact** - Assess potential change impacts (mock implementation)
10. **getRFCStatus** - Comprehensive status and progress tracking

## Quick Start

### Installation

```bash
npm install
```

### Run Examples

```bash
# Domain model demonstration
npm run example:domain

# Lead agent tools demonstration  
npm run example:tools

# AI integration example (requires ANTHROPIC_API_KEY)
npm run example:ai
```

### Run Tests

```bash
# All tests
npm test

# Domain model tests only
npm test src/domain

# Tools integration tests
npm test src/tools
```

## Usage Examples

### Basic Domain Model Usage

```typescript
import { RFCDomainModel, AgentType } from './src/domain';

const model = new RFCDomainModel();

// Create agents
const leadAgent = await model.createAgent(AgentType.LEAD, 'Lead Architect');
const backendAgent = await model.createAgent(AgentType.BACKEND, 'Backend Expert');

// Create RFC
const rfc = await model.createRFC(
  'API Authentication RFC',
  'Migrate to OAuth 2.0',
  leadAgent.id,
  'user-session-123'
);

// Request review
const review = await model.requestReview({
  rfcId: rfc.id,
  requestedBy: leadAgent.id,
  reviewerAgentIds: [backendAgent.id]
});
```

### AI Agent Tools Integration

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { leadAgentTools, initializeTools } from './src/tools';

// Initialize tools
const domainModel = new RFCDomainModel();
const leadAgent = await domainModel.createAgent(AgentType.LEAD, 'AI Agent');
initializeTools(domainModel, leadAgent.id);

// Use with AI model
const response = await generateText({
  model: anthropic('claude-3-haiku-20240307'),
  tools: leadAgentTools,
  messages: [
    {
      role: 'user',
      content: 'Create an RFC for implementing caching in our API'
    }
  ]
});
```

### RFC Template Generation

```typescript
import { generateRFCTemplate } from './src/tools/rfc-template';

const rfc = generateRFCTemplate({
  title: 'Database Migration RFC',
  description: 'Migrate from MySQL to PostgreSQL',
  author: 'lead-agent',
  status: 'draft',
  created: new Date().toISOString()
}, ['problem', 'solution', 'implementation', 'risks']);
```

## Tool Specifications

Each tool includes:
- **Zod schema validation** for parameters
- **Comprehensive error handling** with user-friendly messages  
- **Type-safe interfaces** with TypeScript
- **Integration with domain model** for consistent data management
- **Support for async operations** with proper promise handling

### Tool Parameter Examples

```typescript
// Create RFC with sections
createRFCDocument.execute({
  title: 'New Feature RFC',
  description: 'Add real-time notifications',
  sections: ['problem', 'solution', 'implementation']
});

// Update content with validation
updateRFCContent.execute({
  rfcId: 'rfc-123',
  oldText: 'current implementation',
  newText: 'improved implementation',
  replaceAll: false
});

// Request targeted review
requestReview.execute({
  rfcId: 'rfc-123', 
  reviewerTypes: ['backend', 'security', 'frontend'],
  specificConcerns: 'Focus on performance and security implications'
});
```

## Testing

Comprehensive test suite covering:

- **Domain model operations** (32 tests, 84% coverage)
- **Template generation and parsing**
- **Complete RFC workflows**
- **Error handling and edge cases**
- **Tool integration scenarios**

```bash
# Run with coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## Architecture Decisions

### Domain-Driven Design
- Clean separation of business logic and infrastructure
- Rich domain models with behavior encapsulation
- Repository pattern for data persistence abstraction

### Tool Design
- Each tool has single responsibility
- Consistent error handling patterns
- Validation at tool boundaries with Zod schemas
- Async-first design for scalability

### Storage Strategy
- Interface-based persistence layer
- In-memory implementation for development
- Easy migration to database backends
- Thread-safe operations for concurrent access

## Configuration

### Environment Variables

```bash
# Required for AI integration examples
ANTHROPIC_API_KEY=your_api_key_here
```

### TypeScript Configuration

The project uses strict TypeScript settings:
- Strict null checks
- No unused locals/parameters  
- No implicit returns
- Comprehensive type coverage

## Contributing

### Development Workflow

1. Write failing tests first
2. Implement functionality
3. Ensure all tests pass
4. Run examples to verify integration
5. Update documentation

### Code Standards

- Use TypeScript strict mode
- Follow domain-driven design principles
- Comprehensive error handling
- Clear, self-documenting code
- Full test coverage for new features

## Performance Considerations

- **Lazy loading**: Domain model services created on demand
- **Efficient queries**: Proper indexing in storage layer
- **Memory management**: Stateless tool implementations
- **Async operations**: Non-blocking I/O throughout
- **Caching friendly**: Immutable data structures where possible

## Security Features

- **Input validation**: Zod schemas prevent malformed data
- **Agent permissions**: Role-based access control
- **Audit trails**: Comprehensive change tracking
- **Safe operations**: Atomic transactions for critical updates

## Future Enhancements

- Database backend implementation (PostgreSQL, MongoDB)
- Real-time collaboration with WebSockets
- Full-text search with Elasticsearch
- Notification system for review requests
- API server with REST/GraphQL endpoints
- Web UI for non-agent users
- Integration with version control systems
- Advanced analytics and reporting

## License

ISC License - See package.json for details.

## Support

For issues and questions:
- Review the examples in `src/examples/`
- Check the test files for usage patterns
- Examine the domain model documentation
- Create GitHub issues for bugs or feature requests