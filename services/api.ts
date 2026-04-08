import { getActiveIp } from '@/services/knightswatch';

const getBaseUrl = () => `http://${getActiveIp()}:8765`;

interface LLMRequest {
  model: string;
  prompt: string;
}

interface LLMResponse {
  response: string;
}

interface RunRequest {
  command: string;
}

interface RunResponse {
  status: string;
  command: string;
  stdout: string;
  stderr: string;
  returncode: number;
}

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

interface WriteFileRequest {
  path: string;
  content: string;
}

export const api = {
  async llm(model: string, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 seconds

    try {
      const response = await fetch(`${getBaseUrl()}/llm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
        } as LLMRequest),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.statusText}`);
      }

      const data = (await response.json()) as LLMResponse;
      return data.response;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async run(command: string): Promise<string> {
    const response = await fetch(`${getBaseUrl()}/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command } as RunRequest),
    });

    if (!response.ok) {
      throw new Error(`Run request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as RunResponse;
    // Return stdout if available, otherwise return empty string
    return data.stdout || '';
  },

  async scanProject(root: string): Promise<FileItem[]> {
    const response = await fetch(
      `${getBaseUrl()}/scan-project?root=${encodeURIComponent(root)}`
    );

    if (!response.ok) {
      throw new Error(`Scan project request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { root: string; files: string[] };
    // Transform the flat file list into FileItem objects
    return data.files.map((filePath) => {
      const name = filePath.includes('\\')
        ? filePath.split('\\').pop() || filePath
        : filePath.split('/').pop() || filePath;
      const isDirectory = filePath.endsWith('\\') || filePath.endsWith('/');
      return {
        name,
        path: filePath,
        type: isDirectory ? 'directory' : 'file',
      };
    });
  },

  async readFile(path: string): Promise<string> {
    // Try POST method first
    const response = await fetch(`${getBaseUrl()}/read-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    });

    if (!response.ok) {
      throw new Error('File read endpoint not available on server');
    }

    const data = (await response.json()) as { content: string };
    return data.content;
  },

  async writeFile(path: string, content: string): Promise<void> {
    const response = await fetch(`${getBaseUrl()}/write-file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path, content } as WriteFileRequest),
    });

    if (!response.ok) {
      throw new Error(`Write file request failed: ${response.statusText}`);
    }
  },
};
