/**
 * Friday Context Service
 * Detects and injects project context into LLM requests
 */

interface ProjectContext {
  projectName: string;
  branch: string;
  framework: string;
  currentDirectory: string;
  recentCommits: string[];
  dirtyFiles: string[];
  lastUpdated: number;
}

interface CachedContext {
  data: ProjectContext;
  expiresAt: number;
}

let contextCache: CachedContext | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Fetch project context from KNIGHTSWATCH (Friday's local agent system)
 */
const fetchProjectContextFromKnightswatch = async (): Promise<ProjectContext> => {
  try {
    // Use Promise.race with timeout to avoid hanging
    const controller = new AbortController();
    const fetchPromise = fetch('http://100.112.253.127:8080/api/project-context', {
      method: 'GET',
      signal: controller.signal,
    });

    const timeoutPromise = new Promise<Response>((_, reject) =>
      setTimeout(() => {
        controller.abort();
        reject(new Error('KNIGHTSWATCH timeout'));
      }, 3000)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (response.ok) {
      return await response.json();
    }
  } catch (httpError) {
    console.warn('[FridayContext] KNIGHTSWATCH unavailable (this is OK):', (httpError as Error).message);
  }

  // Fallback to default context if KNIGHTSWATCH is unavailable
  return getDefaultContext();
};

/**
 * Get default context when KNIGHTSWATCH is unavailable
 */
const getDefaultContext = (): ProjectContext => {
  return {
    projectName: 'FridayMobile',
    branch: 'main',
    framework: 'React Native / Expo',
    currentDirectory: '/Users/oscar/Desktop/apps/FridayMobile',
    recentCommits: [
      'feat: voice conversation system',
      'fix: onboarding modal',
      'chore: setup project',
    ],
    dirtyFiles: [],
    lastUpdated: Date.now(),
  };
};

/**
 * Get project context with caching
 */
export const getProjectContext = async (): Promise<ProjectContext> => {
  const now = Date.now();

  // Return cached context if still valid
  if (contextCache && contextCache.expiresAt > now) {
    return contextCache.data;
  }

  // Fetch fresh context
  const context = await fetchProjectContextFromKnightswatch();
  context.lastUpdated = now;

  // Update cache
  contextCache = {
    data: context,
    expiresAt: now + CACHE_DURATION,
  };

  return context;
};

/**
 * Format project context as a system prompt prefix
 */
export const formatContextPrompt = (context: ProjectContext): string => {
  const dirtyFilesStr =
    context.dirtyFiles.length > 0
      ? `\nModified files:\n${context.dirtyFiles.map((f) => `- ${f}`).join('\n')}`
      : '';

  const recentCommitsStr =
    context.recentCommits.length > 0
      ? `\nRecent commits:\n${context.recentCommits.slice(0, 3).map((c) => `- ${c}`).join('\n')}`
      : '';

  return `You are F.R.I.D.A.Y., an AI assistant helping with development.

PROJECT CONTEXT:
Project: ${context.projectName}
Framework: ${context.framework}
Current Branch: ${context.branch}
Directory: ${context.currentDirectory}
${recentCommitsStr}${dirtyFilesStr}

When the user asks about code, files, or development tasks, use this context to provide relevant assistance.`;
};

/**
 * Inject project context into a message
 */
export const injectContextIntoMessage = async (userMessage: string): Promise<string> => {
  try {
    const context = await getProjectContext();
    const contextPrompt = formatContextPrompt(context);
    return `${contextPrompt}\n\nUser: ${userMessage}`;
  } catch (error) {
    console.error('Error injecting context:', error);
    return userMessage;
  }
};

/**
 * Clear cached context (useful for forcing refresh)
 */
export const clearContextCache = (): void => {
  contextCache = null;
};

/**
 * Validate KNIGHTSWATCH connection
 */
export const validateKnightswatchConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch('http://100.112.253.127:8080/health', {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('KNIGHTSWATCH health check failed:', error);
    return false;
  }
};

/**
 * Get status object for UI display
 */
export const getContextStatus = async (): Promise<{
  connected: boolean;
  projectName: string;
  branch: string;
}> => {
  const connected = await validateKnightswatchConnection();
  const context = await getProjectContext();

  return {
    connected,
    projectName: context.projectName,
    branch: context.branch,
  };
};
