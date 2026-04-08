/**
 * Task Manager Service (Pattern 3: Claude Code Task.ts)
 *
 * Manages background operations as typed, trackable tasks.
 * Tasks are non-blocking, killable, and recoverable.
 */

import type { FridayTask, FridayTaskType, FridayTaskStatus } from '@/lib/friday/types'

type TaskListener = (tasks: FridayTask[]) => void

class TaskManager {
  private tasks: Map<string, FridayTask> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()
  private listeners: TaskListener[] = []
  private idCounter = 0

  /**
   * Create and register a new task. Returns the task ID.
   */
  create(type: FridayTaskType, description: string): string {
    const id = `task_${Date.now()}_${++this.idCounter}`
    const task: FridayTask = {
      id,
      type,
      status: 'pending',
      description,
      startTime: Date.now(),
      endTime: null,
      error: null,
    }
    this.tasks.set(id, task)
    this.notify()
    return id
  }

  /**
   * Run an async operation as a tracked task.
   * Provides an AbortSignal the operation can check for cancellation.
   */
  async run<T>(
    type: FridayTaskType,
    description: string,
    operation: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const id = this.create(type, description)
    const controller = new AbortController()
    this.abortControllers.set(id, controller)

    this.updateStatus(id, 'running')

    try {
      const result = await operation(controller.signal)
      this.updateStatus(id, 'completed')
      return result
    } catch (err) {
      if (controller.signal.aborted) {
        this.updateStatus(id, 'killed')
      } else {
        const task = this.tasks.get(id)
        if (task) {
          task.error = err instanceof Error ? err.message : String(err)
          task.status = 'failed'
          task.endTime = Date.now()
          this.notify()
        }
      }
      throw err
    } finally {
      this.abortControllers.delete(id)
    }
  }

  /**
   * Kill a running task by ID.
   */
  kill(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
      this.updateStatus(taskId, 'killed')
      this.abortControllers.delete(taskId)
      return true
    }
    return false
  }

  /**
   * Kill all running tasks.
   */
  killAll(): number {
    let killed = 0
    for (const [id, controller] of this.abortControllers) {
      controller.abort()
      this.updateStatus(id, 'killed')
      killed++
    }
    this.abortControllers.clear()
    return killed
  }

  /**
   * Get all active (pending or running) tasks.
   */
  getActive(): FridayTask[] {
    return Array.from(this.tasks.values()).filter(
      t => t.status === 'pending' || t.status === 'running'
    )
  }

  /**
   * Get all tasks.
   */
  getAll(): FridayTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * Get a task by ID.
   */
  get(taskId: string): FridayTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * Format active tasks for display or prompt injection.
   */
  formatActive(): string {
    const active = this.getActive()
    if (active.length === 0) return ''

    return active
      .map(t => {
        const elapsed = Math.round((Date.now() - t.startTime) / 1000)
        return `- [${t.status}] ${t.description} (${elapsed}s)`
      })
      .join('\n')
  }

  /**
   * Clean up completed/failed/killed tasks older than maxAge ms.
   */
  prune(maxAge: number = 5 * 60 * 1000): number {
    const cutoff = Date.now() - maxAge
    let pruned = 0
    for (const [id, task] of this.tasks) {
      if (
        task.endTime &&
        task.endTime < cutoff &&
        (task.status === 'completed' || task.status === 'failed' || task.status === 'killed')
      ) {
        this.tasks.delete(id)
        pruned++
      }
    }
    if (pruned > 0) this.notify()
    return pruned
  }

  /**
   * Subscribe to task list changes.
   */
  subscribe(listener: TaskListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private updateStatus(id: string, status: FridayTaskStatus): void {
    const task = this.tasks.get(id)
    if (task) {
      task.status = status
      if (status === 'completed' || status === 'failed' || status === 'killed') {
        task.endTime = Date.now()
      }
      this.notify()
    }
  }

  private notify(): void {
    const tasks = this.getAll()
    for (const listener of this.listeners) {
      try {
        listener(tasks)
      } catch (e) {
        console.error('[TaskManager] Listener error:', e)
      }
    }
  }
}

/** Singleton task manager instance */
export const taskManager = new TaskManager()
