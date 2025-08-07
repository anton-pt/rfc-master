export type RFCSection = 
  | "problem" 
  | "solution" 
  | "alternatives" 
  | "implementation" 
  | "rollout" 
  | "risks";

export interface RFCMetadata {
  title: string;
  description: string;
  author: string;
  status: string;
  created: string;
}

const sectionTemplates: Record<RFCSection, string> = {
  problem: `## Problem Statement

<!-- Describe the problem this RFC solves -->
- What is the current situation?
- What are the pain points?
- What are the user needs that are not being met?

`,
  
  solution: `## Proposed Solution

<!-- High-level description of the proposed solution -->
- What is the core approach?
- How does this solve the problem?
- What are the key components?

`,
  
  alternatives: `## Alternatives Considered

<!-- Alternative approaches that were considered and why they were rejected -->
1. **Alternative 1**: Description
   - Pros:
   - Cons:
   - Why rejected:

`,
  
  implementation: `## Implementation Details

<!-- Technical details of how the solution will be implemented -->

### Architecture

<!-- System architecture overview -->

### API Changes

<!-- Any API changes required -->

### Database Changes

<!-- Any database schema changes -->

### Migration Strategy

<!-- How to migrate from current to new system -->

`,
  
  rollout: `## Rollout Plan

<!-- How the change will be rolled out -->

### Phase 1: Foundation
<!-- Initial implementation -->

### Phase 2: Rollout
<!-- Gradual rollout strategy -->

### Phase 3: Full Deployment
<!-- Complete rollout -->

### Rollback Plan
<!-- How to rollback if issues occur -->

`,
  
  risks: `## Risks and Mitigations

<!-- Potential risks and how to mitigate them -->

### Technical Risks
- **Risk**: Description
  - **Likelihood**: High/Medium/Low
  - **Impact**: High/Medium/Low  
  - **Mitigation**: Strategy

### Business Risks
- **Risk**: Description
  - **Likelihood**: High/Medium/Low
  - **Impact**: High/Medium/Low
  - **Mitigation**: Strategy

`
};

export function generateRFCTemplate(metadata: RFCMetadata, sections: RFCSection[] = []): string {
  const header = `---
title: ${metadata.title}
description: ${metadata.description}
author: ${metadata.author}
status: ${metadata.status}
created: ${metadata.created}
---

# ${metadata.title}

${metadata.description}

`;

  const sectionContent = sections.map(section => sectionTemplates[section]).join('');
  
  const footer = `## Questions and Discussion

<!-- Questions for reviewers and space for discussion -->

---

## Review Status

<!-- This section will be updated as reviews come in -->
- [ ] Frontend Review
- [ ] Backend Review  
- [ ] Security Review
- [ ] Database Review
- [ ] Infrastructure Review

`;

  return header + sectionContent + footer;
}

export function findSectionInContent(content: string, sectionTitle: string): number {
  const lines = content.split('\n');
  const sectionRegex = new RegExp(`^#+\\s+${sectionTitle}`, 'i');
  
  for (let i = 0; i < lines.length; i++) {
    if (sectionRegex.test(lines[i])) {
      return i;
    }
  }
  
  return -1;
}

export function insertSectionAfter(content: string, afterSection: string, newSectionTitle: string, newContent: string): string {
  const lines = content.split('\n');
  const afterIndex = findSectionInContent(content, afterSection);
  
  if (afterIndex === -1) {
    // If section not found, append at the end
    return content + `\n\n## ${newSectionTitle}\n\n${newContent}\n`;
  }
  
  // Find the end of the section (next section or end of document)
  let insertIndex = lines.length;
  for (let i = afterIndex + 1; i < lines.length; i++) {
    if (lines[i].match(/^#+\s+/)) {
      insertIndex = i;
      break;
    }
  }
  
  // Insert the new section
  const newSection = [`\n## ${newSectionTitle}`, '', newContent, ''];
  lines.splice(insertIndex, 0, ...newSection);
  
  return lines.join('\n');
}