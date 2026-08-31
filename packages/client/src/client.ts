import { DitroyAPIError, DitroyNetworkError } from "./errors.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamOptions,
  ConversationListResponse,
  ConversationMessagesResponse,
  DitroyClientOptions,
  HealthStatus,
  NewConversationRequest,
  NewConversationResponse,
} from "./types.js";

/**
 * Universal client SDK for interacting with the DITroy AI Backend.
 * Works seamlessly across Node.js, Next.js, Express, browsers, React Native, and Edge runtimes.
 */
export class DitroyClient {
  public readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly headers: Record<string, string>;
  private readonly customFetch?: typeof fetch;

  constructor(options: DitroyClientOptions = {}) {
    const envUrl =
      typeof process !== "undefined" && process.env
        ? process.env.DITROY_API_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          process.env.API_BASE_URL
        : undefined;

    this.baseUrl = (options.baseUrl || envUrl || "http://localhost:8000").replace(
      /\/+$/,
      "",
    );
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.headers = {
      "Content-Type": "application/json",
      ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      ...(options.headers || {}),
    };
    this.customFetch = options.customFetch;
  }

  /**
   * Internal request dispatcher with timeout and standardized error handling.
   */
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const fetchFn =
      this.customFetch ||
      (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);

    if (!fetchFn) {
      throw new DitroyNetworkError(
        "No fetch implementation found. In Node < 18, supply customFetch in DitroyClientOptions.",
      );
    }

    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetchFn(url, {
        ...init,
        headers: {
          ...this.headers,
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }

        const message =
          typeof errorBody === "object" && errorBody !== null && "detail" in errorBody
            ? String((errorBody as { detail: unknown }).detail)
            : response.statusText || `HTTP ${response.status}`;

        throw new DitroyAPIError(response.status, message, errorBody);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof DitroyAPIError) {
        throw err;
      }
      if (err instanceof Error && err.name === "AbortError") {
        throw new DitroyNetworkError(`Request timed out after ${this.timeoutMs}ms`, err);
      }
      throw new DitroyNetworkError(
        `Failed to reach DITroy API at ${url}: ${(err as Error)?.message || String(err)}`,
        err instanceof Error ? err : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Send a chat message to the DITroy AI backend.
   *
   * @param request The text prompt or ChatRequest object.
   * @returns ChatResponse containing the AI reply.
   */
  public async chat(request: string | ChatRequest): Promise<ChatResponse> {
    const payload: { message: string; conversation_id: string } =
      typeof request === "string"
        ? { message: request, conversation_id: "default" }
        : {
            message: request.message,
            conversation_id:
              request.conversation_id || request.conversationId || "default",
          };

    return this.request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Stream a chat response in real-time token-by-token from the DITroy AI backend.
   *
   * @param request The text prompt or ChatRequest object.
   * @param options Optional callbacks (onToken) or AbortSignal.
   * @returns An AsyncIterableIterator yielding each token as it arrives.
   */
  public async *chatStream(
    request: string | ChatRequest,
    options: ChatStreamOptions = {},
  ): AsyncIterableIterator<string> {
    const fetchFn =
      this.customFetch ||
      (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);

    if (!fetchFn) {
      throw new DitroyNetworkError(
        "No fetch implementation found. In Node < 18, supply customFetch in DitroyClientOptions.",
      );
    }

    const payload: { message: string; conversation_id: string } =
      typeof request === "string"
        ? { message: request, conversation_id: "default" }
        : {
            message: request.message,
            conversation_id:
              request.conversation_id || request.conversationId || "default",
          };

    const url = `${this.baseUrl}/chat/stream`;
    const response = await fetchFn(url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw new DitroyAPIError(
        response.status,
        response.statusText || `HTTP ${response.status}`,
        errorBody,
      );
    }

    if (!response.body) {
      throw new DitroyNetworkError(
        "ReadableStream not supported or empty body returned from server.",
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") return;

          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.token) {
              options.onToken?.(parsed.token);
              yield parsed.token;
            } else if (parsed.error) {
              throw new DitroyAPIError(500, parsed.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof DitroyAPIError) throw parseErr;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create a new conversation session, automatically inheriting learned facts from a source conversation.
   *
   * @param request Optional NewConversationRequest containing source_conversation_id.
   * @returns NewConversationResponse containing the new conversation_id and inherited fact count.
   */
  public async createConversation(
    request: NewConversationRequest = {},
  ): Promise<NewConversationResponse> {
    const sourceId =
      request.source_conversation_id || request.sourceConversationId || "default";

    return this.request<NewConversationResponse>("/conversations", {
      method: "POST",
      body: JSON.stringify({ source_conversation_id: sourceId }),
    });
  }

  /**
   * List all stored conversations with their last updated time and preview titles.
   */
  public async listConversations(): Promise<ConversationListResponse> {
    return this.request<ConversationListResponse>("/conversations", {
      method: "GET",
    });
  }

  /**
   * Retrieve message history for a given conversation.
   *
   * @param conversationId Unique identifier of the conversation.
   * @param options Optional limit for messages returned (default: 200).
   */
  public async getMessages(
    conversationId: string,
    options: { limit?: number } = {},
  ): Promise<ConversationMessagesResponse> {
    const limit = options.limit ?? 200;
    return this.request<ConversationMessagesResponse>(
      `/conversations/${encodeURIComponent(conversationId)}/messages?limit=${limit}`,
      { method: "GET" },
    );
  }

  /**
   * Check health and availability of the DITroy backend and local model.
   */
  public async getHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>("/health", {
      method: "GET",
    });
  }
}
