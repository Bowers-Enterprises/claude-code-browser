# Story Index: Claude Code Browser

## Epic 1: Extension Foundation
Set up VS Code extension scaffolding with TypeScript, build system, and basic activation.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| 1.1 | [Initialize VS Code extension project](epic_01/story_1.1.md) | P0 | Pending |
| 1.2 | [Create sidebar view container](epic_01/story_1.2.md) | P0 | Pending |
| 1.3 | [Implement extension activation](epic_01/story_1.3.md) | P0 | Pending |

## Epic 2: Resource Discovery
Implement parsers and providers for each resource type.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| 2.1 | [Implement Skills TreeDataProvider](epic_02/story_2.1.md) | P0 | Pending |
| 2.2 | [Implement skill YAML parser](epic_02/story_2.2.md) | P0 | Pending |
| 2.3 | [Implement Agents TreeDataProvider](epic_02/story_2.3.md) | P0 | Pending |
| 2.4 | [Implement agent markdown parser](epic_02/story_2.4.md) | P0 | Pending |
| 2.5 | [Implement MCP Servers TreeDataProvider](epic_02/story_2.5.md) | P0 | Pending |
| 2.6 | [Implement Plugins TreeDataProvider](epic_02/story_2.6.md) | P0 | Pending |

## Epic 3: Interaction & Polish
Add click-to-invoke, search, and refresh capabilities.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| 3.1 | [Implement click-to-invoke command](epic_03/story_3.1.md) | P0 | Pending |
| 3.2 | [Add clipboard fallback](epic_03/story_3.2.md) | P0 | Pending |
| 3.3 | [Implement search/filter](epic_03/story_3.3.md) | P1 | Pending |
| 3.4 | [Add refresh command](epic_03/story_3.4.md) | P1 | Pending |
| 3.5 | [Add scope badges (Global/Project)](epic_03/story_3.5.md) | P1 | Pending |

---

## Summary

| Epic | Stories | P0 | P1 |
|------|---------|----|----|
| 1. Extension Foundation | 3 | 3 | 0 |
| 2. Resource Discovery | 6 | 6 | 0 |
| 3. Interaction & Polish | 5 | 2 | 3 |
| **Total** | **14** | **11** | **3** |

---

## Suggested Sprint Plan

### Sprint 1: Foundation + Core Discovery
- Story 1.1: Initialize project
- Story 1.2: Create sidebar container
- Story 1.3: Implement activation
- Story 2.1: Skills provider
- Story 2.2: Skill parser

### Sprint 2: Complete Discovery
- Story 2.3: Agents provider
- Story 2.4: Agent parser
- Story 2.5: MCP provider
- Story 2.6: Plugins provider

### Sprint 3: Interaction + Polish
- Story 3.1: Click-to-invoke
- Story 3.2: Clipboard fallback
- Story 3.3: Search/filter
- Story 3.4: Refresh command
- Story 3.5: Scope badges

---

## Dependencies

```
1.1 → 1.2 → 1.3
          ↓
        2.1 → 2.2
        2.3 → 2.4
        2.5
        2.6
          ↓
        3.1 → 3.2
        3.3
        3.4
        3.5
```

Notes:
- 1.x stories must complete before 2.x
- 2.x stories can be parallelized
- 3.x depends on at least one provider working
- 3.1 and 3.2 are sequential (fallback needs invoke first)
- 3.3, 3.4, 3.5 can be parallelized
