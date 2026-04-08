/**
 * Friday Memory Store - SQLite Persistence Layer
 * Pattern 1: Typed memories (user/feedback/project/reference) from Claude Code memdir
 */

import * as SQLite from 'expo-sqlite'
import type { FridayMemory, FridayMemoryType, FridayPersonality } from './types'

export class FridayMemoryStore {
  private db: SQLite.SQLiteDatabase

  /**
   * Factory function: Create and initialize memory store
   */
  static async create(dbName: string = 'friday.db'): Promise<FridayMemoryStore> {
    const db = await SQLite.openDatabaseAsync(dbName)
    const store = new FridayMemoryStore(db)
    await store.initSchema()
    await store.migrateMemoryTypes()
    return store
  }

  private constructor(db: SQLite.SQLiteDatabase) {
    this.db = db
  }

  /**
   * Initialize database schema
   */
  private async initSchema(): Promise<void> {
    try {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memories (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          relevanceScore REAL DEFAULT 0.5
        );

        CREATE TABLE IF NOT EXISTS personality (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          traits TEXT NOT NULL,
          communicationStyle TEXT NOT NULL,
          interests TEXT NOT NULL,
          updatedAt INTEGER NOT NULL,
          interactionCount INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          source TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_memories_timestamp
          ON memories(timestamp DESC);

        CREATE INDEX IF NOT EXISTS idx_memories_type
          ON memories(type);

        CREATE INDEX IF NOT EXISTS idx_conversations_timestamp
          ON conversations(timestamp DESC);
      `)
    } catch (error) {
      console.error('Failed to initialize Friday schema:', error)
      throw error
    }
  }

  /**
   * Migrate old memory types to new typed system.
   * interaction -> user, preference -> feedback, fact -> reference, learning -> project
   */
  private async migrateMemoryTypes(): Promise<void> {
    try {
      const migrations: [string, FridayMemoryType][] = [
        ['interaction', 'user'],
        ['preference', 'feedback'],
        ['fact', 'reference'],
        ['learning', 'project'],
      ]

      for (const [oldType, newType] of migrations) {
        await this.db.runAsync(
          `UPDATE memories SET type = ? WHERE type = ?`,
          [newType, oldType]
        )
      }
    } catch (error) {
      // Migration is best-effort — don't crash on failure
      console.warn('Memory type migration skipped:', error)
    }
  }

  /**
   * Get recent memories with optional type filter
   */
  async getRecentMemories(limit: number = 10, type?: FridayMemoryType): Promise<FridayMemory[]> {
    try {
      let query = `SELECT * FROM memories`
      const params: any[] = []

      if (type) {
        query += ` WHERE type = ?`
        params.push(type)
      }

      query += ` ORDER BY timestamp DESC LIMIT ?`
      params.push(limit)

      const result = await this.db.getAllAsync<FridayMemory>(query, params)
      return result || []
    } catch (error) {
      console.error('Failed to get recent memories:', error)
      return []
    }
  }

  /**
   * Get all memory headers (id, type, first line of content) for relevance selection.
   * Pattern: Memory index scan from Claude Code findRelevantMemories.ts
   */
  async getMemoryHeaders(): Promise<{ id: string; type: FridayMemoryType; summary: string }[]> {
    try {
      const result = await this.db.getAllAsync<{ id: string; type: string; content: string }>(
        `SELECT id, type, content FROM memories ORDER BY timestamp DESC LIMIT 50`
      )

      return (result || []).map(row => ({
        id: row.id,
        type: row.type as FridayMemoryType,
        summary: row.content.split('\n')[0].slice(0, 120),
      }))
    } catch (error) {
      console.error('Failed to get memory headers:', error)
      return []
    }
  }

  /**
   * Get specific memories by IDs (for loading after relevance selection).
   */
  async getMemoriesByIds(ids: string[]): Promise<FridayMemory[]> {
    if (ids.length === 0) return []
    try {
      const placeholders = ids.map(() => '?').join(',')
      const result = await this.db.getAllAsync<FridayMemory>(
        `SELECT * FROM memories WHERE id IN (${placeholders})`,
        ids
      )
      return result || []
    } catch (error) {
      console.error('Failed to get memories by IDs:', error)
      return []
    }
  }

  /**
   * Get personality configuration
   */
  async getPersonality(): Promise<FridayPersonality | null> {
    try {
      const result = await this.db.getFirstAsync<any>(
        `SELECT * FROM personality LIMIT 1`
      )
      if (!result) return null

      return {
        id: result.id,
        name: result.name,
        traits: typeof result.traits === 'string' ? JSON.parse(result.traits) : result.traits,
        communicationStyle: result.communicationStyle,
        interests: typeof result.interests === 'string' ? JSON.parse(result.interests) : result.interests,
        updatedAt: result.updatedAt,
      } as FridayPersonality
    } catch (error) {
      console.error('Failed to get personality:', error)
      return null
    }
  }

  /**
   * Add a new typed memory
   */
  async addMemory(
    type: FridayMemoryType,
    content: string,
    relevanceScore: number = 0.5
  ): Promise<string> {
    try {
      const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await this.db.runAsync(
        `INSERT INTO memories (id, type, content, timestamp, relevanceScore)
         VALUES (?, ?, ?, ?, ?)`,
        [id, type, content, Date.now(), relevanceScore]
      )
      return id
    } catch (error) {
      console.error('Failed to add memory:', error)
      throw error
    }
  }

  /**
   * Save or update personality
   */
  async setPersonality(
    personality: Omit<FridayPersonality, 'id' | 'updatedAt'>
  ): Promise<void> {
    try {
      const id = 'default'
      const interactionCount =
        personality && 'interactionCount' in (personality as any)
          ? (personality as any).interactionCount
          : 0

      await this.db.runAsync(
        `INSERT OR REPLACE INTO personality
         (id, name, traits, communicationStyle, interests, updatedAt, interactionCount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          personality.name,
          JSON.stringify(personality.traits),
          personality.communicationStyle,
          JSON.stringify(personality.interests),
          Date.now(),
          interactionCount,
        ]
      )
    } catch (error) {
      console.error('Failed to set personality:', error)
      throw error
    }
  }

  /**
   * Increment interaction count for personality warmth
   */
  async incrementInteractionCount(): Promise<number> {
    try {
      const personality = await this.getPersonality()
      if (!personality) return 0

      const newCount = (personality as any).interactionCount
        ? (personality as any).interactionCount + 1
        : 1

      await this.db.runAsync(
        `UPDATE personality SET interactionCount = ? WHERE id = ?`,
        [newCount, 'default']
      )

      return newCount
    } catch (error) {
      console.error('Failed to increment interaction count:', error)
      return 0
    }
  }

  /**
   * Get interaction count for warmth detection
   */
  async getInteractionCount(): Promise<number> {
    try {
      const result = await this.db.getFirstAsync<{ interactionCount: number }>(
        `SELECT interactionCount FROM personality WHERE id = ?`,
        ['default']
      )
      return result?.interactionCount || 0
    } catch (error) {
      console.error('Failed to get interaction count:', error)
      return 0
    }
  }

  /**
   * Add conversation message to history
   */
  async addConversationMessage(
    role: 'user' | 'assistant',
    content: string,
    source: string = 'ollama'
  ): Promise<string> {
    try {
      const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await this.db.runAsync(
        `INSERT INTO conversations (id, role, content, timestamp, source)
         VALUES (?, ?, ?, ?, ?)`,
        [id, role, content, Date.now(), source]
      )
      return id
    } catch (error) {
      console.error('Failed to add conversation message:', error)
      throw error
    }
  }

  /**
   * Get memory count by type (for usage tracking / diagnostics).
   */
  async getMemoryCounts(): Promise<Record<FridayMemoryType, number>> {
    const counts: Record<FridayMemoryType, number> = {
      user: 0,
      feedback: 0,
      project: 0,
      reference: 0,
    }

    try {
      const rows = await this.db.getAllAsync<{ type: string; count: number }>(
        `SELECT type, COUNT(*) as count FROM memories GROUP BY type`
      )
      for (const row of rows || []) {
        if (row.type in counts) {
          counts[row.type as FridayMemoryType] = row.count
        }
      }
    } catch (error) {
      console.error('Failed to get memory counts:', error)
    }

    return counts
  }

  /**
   * Delete a memory by ID (used during dream pruning).
   */
  async deleteMemory(id: string): Promise<void> {
    try {
      await this.db.runAsync(`DELETE FROM memories WHERE id = ?`, [id])
    } catch (error) {
      console.error('Failed to delete memory:', error)
    }
  }

  /**
   * Clear all memories (reset)
   */
  async clearAllMemories(): Promise<void> {
    try {
      await this.db.runAsync(`DELETE FROM memories`)
    } catch (error) {
      console.error('Failed to clear memories:', error)
      throw error
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    try {
      await this.db.closeAsync()
    } catch (error) {
      console.error('Failed to close database:', error)
    }
  }
}
