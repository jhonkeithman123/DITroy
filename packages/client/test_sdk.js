import assert from "node:assert";
import { DitroyClient, DitroyAPIError, DitroyNetworkError } from "./dist/index.js";

async function testSDK() {
  console.log("Testing @ditroy/client SDK...");

  // Mock fetch to simulate FastAPI backend responses
  let lastUrl = "";
  let lastMethod = "";
  let lastBody = null;

  const mockFetch = async (url, options = {}) => {
    lastUrl = String(url);
    lastMethod = options.method || "GET";
    lastBody = options.body ? JSON.parse(String(options.body)) : null;

    if (lastUrl.endsWith("/chat")) {
      return {
        ok: true,
        json: async () => ({ reply: `Echoed: ${lastBody.message}` }),
      };
    }

    if (lastUrl.endsWith("/conversations") && lastMethod === "POST") {
      return {
        ok: true,
        json: async () => ({
          conversation_id: "test-uuid-1234",
          inherited_facts: 2,
        }),
      };
    }

    if (lastUrl.endsWith("/conversations") && lastMethod === "GET") {
      return {
        ok: true,
        json: async () => ({
          conversations: [
            {
              conversation_id: "conv-1",
              title: "Test Conversation",
              updated_at: "2026-08-30T12:00:00Z",
            },
          ],
        }),
      };
    }

    if (lastUrl.includes("/messages")) {
      return {
        ok: true,
        json: async () => ({
          conversation_id: "conv-1",
          messages: [
            { role: "user", content: "Hello", created_at: "2026-08-30T12:00:00Z" },
            { role: "assistant", content: "Hi", created_at: "2026-08-30T12:00:01Z" },
          ],
        }),
      };
    }

    if (lastUrl.endsWith("/health")) {
      return {
        ok: true,
        json: async () => ({
          status: "ok",
          service: "ditroy-engine",
          mode: "local-model",
          provider: "ollama",
          model: "llama3.2",
          model_status: "ok",
        }),
      };
    }

    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ detail: "Not found" }),
    };
  };

  const client = new DitroyClient({
    baseUrl: "http://127.0.0.1:8000",
    customFetch: mockFetch,
  });

  // 1. Test chat method
  const chatRes = await client.chat({
    message: "Test AI message",
    conversationId: "test-conv",
  });
  assert.strictEqual(chatRes.reply, "Echoed: Test AI message");
  assert.strictEqual(lastUrl, "http://127.0.0.1:8000/chat");
  assert.strictEqual(lastBody.conversation_id, "test-conv");
  console.log("✓ client.chat() works");

  // 2. Test createConversation
  const newConv = await client.createConversation({
    sourceConversationId: "test-conv",
  });
  assert.strictEqual(newConv.conversation_id, "test-uuid-1234");
  assert.strictEqual(newConv.inherited_facts, 2);
  assert.strictEqual(lastBody.source_conversation_id, "test-conv");
  console.log("✓ client.createConversation() works");

  // 3. Test listConversations
  const listRes = await client.listConversations();
  assert.strictEqual(listRes.conversations.length, 1);
  assert.strictEqual(listRes.conversations[0].title, "Test Conversation");
  console.log("✓ client.listConversations() works");

  // 4. Test getMessages
  const msgRes = await client.getMessages("conv-1", { limit: 50 });
  assert.strictEqual(msgRes.messages.length, 2);
  assert.strictEqual(msgRes.messages[0].role, "user");
  console.log("✓ client.getMessages() works");

  // 5. Test getHealth
  const healthRes = await client.getHealth();
  assert.strictEqual(healthRes.status, "ok");
  assert.strictEqual(healthRes.model, "llama3.2");
  console.log("✓ client.getHealth() works");

  // 6. Test Error Handling
  const failingFetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ detail: "Internal AI crash" }),
  });
  const errorClient = new DitroyClient({
    baseUrl: "http://127.0.0.1:8000",
    customFetch: failingFetch,
  });

  try {
    await errorClient.chat("Crash test");
    assert.fail("Should have thrown DitroyAPIError");
  } catch (err) {
    assert(err instanceof DitroyAPIError);
    assert.strictEqual(err.status, 500);
    assert.strictEqual(err.message, "Ditroy API error (500): Internal AI crash");
    console.log("✓ DitroyAPIError handling works");
  }

  console.log("\nAll @ditroy/client SDK tests passed successfully!");
}

testSDK().catch((err) => {
  console.error("SDK Test failed:", err);
  process.exit(1);
});
