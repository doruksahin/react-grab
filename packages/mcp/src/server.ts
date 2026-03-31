import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import fkill from "fkill";
import { z } from "zod";
import {
  CONTEXT_TTL_MS,
  DEFAULT_MCP_PORT,
  HEALTH_CHECK_TIMEOUT_MS,
  POST_KILL_DELAY_MS,
} from "./constants.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const agentContextEntrySchema = z.object({
  componentName: z.string().optional(),
  content: z.string(),
  commentText: z.string().optional(),
});

const agentContextGroupSchema = z.object({
  name: z.string(),
  entries: z.array(agentContextEntrySchema),
});

const agentContextSchema = z.object({
  groups: z
    .array(agentContextGroupSchema)
    .describe("Array of selection groups, each containing entries with HTML content"),
});

type AgentContext = z.infer<typeof agentContextSchema>;

interface StoredContext {
  context: AgentContext;
  submittedAt: number;
}

let latestContext: StoredContext | null = null;

const textResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

const formatContext = (context: AgentContext): string => {
  const parts: string[] = [];
  const nonEmpty = context.groups.filter((g) => g.entries.length > 0);
  const multiGroup = nonEmpty.length > 1;
  let index = 1;

  for (const group of nonEmpty) {
    if (multiGroup) {
      parts.push(`## ${group.name}`);
    }
    for (const entry of group.entries) {
      const header = entry.commentText
        ? `[${index}] ${entry.commentText}`
        : `[${index}]`;
      const componentLine = entry.componentName
        ? `${entry.componentName}:`
        : "";
      parts.push(
        [header, componentLine, entry.content].filter(Boolean).join("\n"),
      );
      index++;
    }
  }

  return parts.join("\n\n");
};

const createMcpServer = (): McpServer => {
  const server = new McpServer(
    { name: "react-grab-mcp", version: "0.1.0" },
    { capabilities: { logging: {} } },
  );

  server.registerTool(
    "get_element_context",
    {
      description:
        "Get the latest React Grab context that was submitted. Returns the most recent UI element selection with its prompt.",
    },
    async () => {
      if (!latestContext) {
        return textResult("No context has been submitted yet.");
      }

      const isExpired = Date.now() - latestContext.submittedAt > CONTEXT_TTL_MS;
      if (isExpired) {
        latestContext = null;
        return textResult("No context has been submitted yet.");
      }

      const result = textResult(formatContext(latestContext.context));
      latestContext = null;
      return result;
    },
  );

  return server;
};

const checkIfServerIsRunning = async (port: number): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
};

interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
}

const sessions = new Map<string, McpSession>();

const createHttpServer = (port: number): Server => {
  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://localhost:${port}`);

    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader(
      "Access-Control-Allow-Methods",
      "POST, GET, DELETE, OPTIONS",
    );
    response.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, mcp-session-id",
    );
    response.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (request.method === "OPTIONS") {
      response.writeHead(204).end();
      return;
    }

    if (url.pathname === "/health") {
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (url.pathname === "/context" && request.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(chunk as Buffer);
      }

      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        latestContext = {
          context: agentContextSchema.parse(body),
          submittedAt: Date.now(),
        };
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ status: "ok" }));
      } catch {
        response
          .writeHead(400, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: "Invalid context payload" }));
      }
      return;
    }

    if (url.pathname === "/mcp") {
      const sessionId = request.headers["mcp-session-id"] as string | undefined;
      const existingSession = sessionId ? sessions.get(sessionId) : undefined;

      if (existingSession) {
        await existingSession.transport.handleRequest(request, response);
        return;
      }

      if (request.method === "POST") {
        const mcpServer = createMcpServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });

        transport.onclose = () => {
          if (transport.sessionId) {
            sessions.delete(transport.sessionId);
          }
        };

        await mcpServer.server.connect(transport);
        await transport.handleRequest(request, response);

        if (transport.sessionId) {
          sessions.set(transport.sessionId, { server: mcpServer, transport });
        }
        return;
      }

      response.writeHead(400, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          error: "No valid session. Send an initialize request first.",
        }),
      );
      return;
    }

    response.writeHead(404).end("Not found");
  });
};

const listenWithRetry = (httpServer: Server, port: number): Promise<void> =>
  new Promise((resolve, reject) => {
    httpServer.once("error", async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EADDRINUSE") {
        reject(error);
        return;
      }

      await fkill(`:${port}`, { force: true, silent: true }).catch(() => {});
      await sleep(POST_KILL_DELAY_MS);

      httpServer.once("error", reject);
      httpServer.listen(port, () => resolve());
    });

    httpServer.listen(port, "127.0.0.1", () => resolve());
  });

const startHttpServer = async (port: number): Promise<Server> => {
  const isAlreadyRunning = await checkIfServerIsRunning(port);

  if (!isAlreadyRunning) {
    await fkill(`:${port}`, { force: true, silent: true }).catch(() => {});
    await sleep(POST_KILL_DELAY_MS);
  }

  const httpServer = createHttpServer(port);
  await listenWithRetry(httpServer, port);

  const handleShutdown = () => {
    httpServer.close();
    process.exit(0);
  };

  process.on("SIGTERM", handleShutdown);
  process.on("SIGINT", handleShutdown);

  return httpServer;
};

interface StartMcpServerOptions {
  port?: number;
  stdio?: boolean;
}

export const startMcpServer = async ({
  port = DEFAULT_MCP_PORT,
  stdio = false,
}: StartMcpServerOptions = {}): Promise<void> => {
  if (stdio) {
    const mcpServer = createMcpServer();
    const transport = new StdioServerTransport();
    await mcpServer.server.connect(transport);

    startHttpServer(port).then(
      () =>
        console.error(`React Grab context server listening on port ${port}`),
      (error) => console.error(`Failed to start context server: ${error}`),
    );
    return;
  }

  await startHttpServer(port);
  console.log(
    `React Grab MCP server listening on http://localhost:${port}/mcp`,
  );
};
