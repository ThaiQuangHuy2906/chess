# Premium Agentic Chess AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing chess app into a Vietnamese local-first premium agentic AI experience.

**Architecture:** Keep `chess.js` as the rule authority, evolve `src/ai.ts` into an agent pipeline, and render structured agent reasoning in `src/App.tsx`. Do not add backend, API keys, or persistent storage in this iteration.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, chess.js.

---

### Task 1: Agent Trace Contract

**Files:**
- Modify: `src/ai.test.ts`
- Modify: `src/ai.ts`

- [ ] **Step 1: Write failing tests**

Add tests asserting `selectAgentMove()` returns `trace`, `goal`, `principalVariation`, `risk`, `toolsUsed`, and Vietnamese explanation text.

- [ ] **Step 2: Run focused test**

Run: `npm test -- src/ai.test.ts`
Expected: fail because the agent trace contract is missing.

- [ ] **Step 3: Implement minimal trace fields**

Extend `AgentDecision` and `CoachInsight`, then populate fields from existing candidate scoring.

- [ ] **Step 4: Run focused test**

Run: `npm test -- src/ai.test.ts`
Expected: pass.

### Task 2: Agent Planning And Reflection

**Files:**
- Modify: `src/ai.test.ts`
- Modify: `src/ai.ts`

- [ ] **Step 1: Write failing tests**

Add tests for mate priority, queen capture preference, plan summaries, risk warnings, and top candidate structure.

- [ ] **Step 2: Run focused test**

Run: `npm test -- src/ai.test.ts`
Expected: fail until planning/reflection fields are implemented.

- [ ] **Step 3: Implement planning helpers**

Add local helpers for material summary, phase detection, tool log, candidate narrative, principal variation, risk text, and coach suggestion.

- [ ] **Step 4: Run focused test**

Run: `npm test -- src/ai.test.ts`
Expected: pass.

### Task 3: Vietnamese Premium UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Update UI copy and panels**

Translate visible text to Vietnamese and add an agent panel for goal, plan, risk, reflection, tools, and candidate moves.

- [ ] **Step 2: Keep UI responsive**

Adjust styles so board, controls, coach, agent panels, and move history fit desktop and mobile without overlap.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: pass without TypeScript errors.

### Task 4: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Review diff**

Run: `git diff -- src/ai.ts src/ai.test.ts src/App.tsx src/App.css docs/superpowers/specs/2026-04-26-premium-agentic-ai-design.md docs/superpowers/plans/2026-04-26-premium-agentic-ai.md`
Expected: diff only contains the intended agentic AI, Vietnamese UI, and docs changes.
