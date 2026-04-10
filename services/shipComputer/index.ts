/**
 * FRIDAY Ship Computer — Full Mac Control Layer
 * "Computer, all hands battle stations."
 *
 * Three core systems:
 * 1. Screen Vision — Friday can see and understand the screen
 * 2. App Control — Friday can operate any Mac application
 * 3. Workflow Engine — Friday chains actions into complex sequences
 *
 * Plus:
 * - Context Awareness — Proactive monitoring
 * - Intent Parser — Natural language → Ship Computer commands
 */

export * as screenVision from './screenVision'
export * as appControl from './appControl'
export * as workflowEngine from './workflowEngine'
export * as contextAwareness from './contextAwareness'
export { parseAndExecute, looksLikeCommand } from './intentParser'
export type { ShipComputerResult } from './intentParser'
export type { CommandResult } from './appControl'
export type { Workflow, WorkflowResult, WorkflowStep } from './workflowEngine'
export type { AwarenessState, AwarenessEvent } from './contextAwareness'
export type { ScreenContext, VisionAnalysis } from './screenVision'
