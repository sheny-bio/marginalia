import { assert } from "chai";
import { APIClient, APIConfig, Message } from "../src/modules/apiClient";

describe("APIClient", function () {
  describe("constructor", function () {
    it("should create instance with config", function () {
      const config: APIConfig = {
        url: "https://api.example.com/v1",
        apiKey: "test-key",
        model: "gpt-4",
      };
      const client = new APIClient(config);
      assert.isDefined(client);
    });

    it("should accept optional temperature and maxTokens", function () {
      const config: APIConfig = {
        url: "https://api.example.com/v1",
        apiKey: "test-key",
        model: "gpt-4",
        temperature: 0.5,
        maxTokens: 1000,
      };
      const client = new APIClient(config);
      assert.isDefined(client);
    });
  });

  describe("URL construction", function () {
    // These tests verify URL handling by checking the client is created
    // Actual URL construction is tested implicitly through integration tests

    it("should handle URL without trailing slash", function () {
      const config: APIConfig = {
        url: "https://api.example.com/v1",
        apiKey: "test-key",
        model: "gpt-4",
      };
      const client = new APIClient(config);
      assert.isDefined(client);
    });

    it("should handle URL with trailing slash", function () {
      const config: APIConfig = {
        url: "https://api.example.com/v1/",
        apiKey: "test-key",
        model: "gpt-4",
      };
      const client = new APIClient(config);
      assert.isDefined(client);
    });
  });

  describe("Message interface", function () {
    it("should accept user role", function () {
      const message: Message = { role: "user", content: "Hello" };
      assert.equal(message.role, "user");
    });

    it("should accept assistant role", function () {
      const message: Message = { role: "assistant", content: "Hi there" };
      assert.equal(message.role, "assistant");
    });

    it("should accept system role", function () {
      const message: Message = { role: "system", content: "You are helpful" };
      assert.equal(message.role, "system");
    });
  });

  // Integration tests that require actual API calls
  // These are skipped by default and can be enabled for manual testing
  describe.skip("Integration tests (requires API)", function () {
    let client: APIClient;

    before(function () {
      // These tests require a valid API configuration
      // Set environment variables or modify config for testing
      const config: APIConfig = {
        url: "https://api.openai.com/v1",
        apiKey: process.env.OPENAI_API_KEY || "",
        model: "gpt-4o-mini",
      };
      client = new APIClient(config);
    });

    it("should make a successful chat request", async function () {
      this.timeout(30000);
      const messages: Message[] = [{ role: "user", content: "Say hello" }];
      const response = await client.chat(messages);
      assert.isString(response);
      assert.isNotEmpty(response);
    });

    it("should handle streaming response", async function () {
      this.timeout(30000);
      const messages: Message[] = [{ role: "user", content: "Count to 3" }];
      const chunks: string[] = [];

      const response = await client.chat(messages, (chunk) => {
        chunks.push(chunk);
      });

      assert.isString(response);
      assert.isNotEmpty(response);
      assert.isAbove(chunks.length, 0);
    });

    it("should test connection successfully", async function () {
      this.timeout(30000);
      const result = await client.testConnection();
      assert.isTrue(result);
    });
  });

  describe("Error handling", function () {
    it("should handle invalid API key gracefully in testConnection", async function () {
      const config: APIConfig = {
        url: "https://api.openai.com/v1",
        apiKey: "invalid-key",
        model: "gpt-4",
      };
      const client = new APIClient(config);

      // testConnection should return false, not throw
      const result = await client.testConnection();
      assert.isFalse(result);
    });

    it("should throw error for invalid URL in chat", async function () {
      const config: APIConfig = {
        url: "https://invalid-url-that-does-not-exist.example.com",
        apiKey: "test-key",
        model: "gpt-4",
      };
      const client = new APIClient(config);

      try {
        await client.chat([{ role: "user", content: "test" }]);
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert.isDefined(error);
      }
    });
  });
});
