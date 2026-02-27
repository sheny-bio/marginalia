import { assert } from "chai";
import { StorageManager } from "../src/modules/storageManager";

describe("StorageManager", function () {
  let storage: StorageManager;
  const testItemID = 999999; // Use a high ID unlikely to conflict

  before(async function () {
    storage = new StorageManager();
    await storage.init();
  });

  beforeEach(async function () {
    // Clear test data before each test
    await storage.clearMessages(testItemID);
  });

  after(async function () {
    // Clean up test data
    await storage.clearMessages(testItemID);
  });

  describe("saveMessage and getMessages", function () {
    it("should save and retrieve a single message", async function () {
      await storage.saveMessage(testItemID, "user", "Hello, world!");
      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 1);
      assert.equal(messages[0].role, "user");
      assert.equal(messages[0].content, "Hello, world!");
    });

    it("should save and retrieve multiple messages in order", async function () {
      await storage.saveMessage(testItemID, "user", "First message");
      await storage.saveMessage(testItemID, "assistant", "Second message");
      await storage.saveMessage(testItemID, "user", "Third message");

      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 3);
      assert.equal(messages[0].content, "First message");
      assert.equal(messages[1].content, "Second message");
      assert.equal(messages[2].content, "Third message");
    });

    it("should save message with tool calls", async function () {
      const toolCalls = [
        { name: "get_paper_info", arguments: { itemID: 123 } },
      ];
      await storage.saveMessage(
        testItemID,
        "assistant",
        "Using tool",
        toolCalls,
      );

      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 1);
      assert.isDefined(messages[0].toolCalls);
      assert.lengthOf(messages[0].toolCalls, 1);
      assert.equal(messages[0].toolCalls[0].name, "get_paper_info");
    });

    it("should return empty array for non-existent itemID", async function () {
      const messages = await storage.getMessages(888888);
      assert.lengthOf(messages, 0);
    });
  });

  describe("clearMessages", function () {
    it("should clear all messages for an item", async function () {
      await storage.saveMessage(testItemID, "user", "Message 1");
      await storage.saveMessage(testItemID, "assistant", "Message 2");

      await storage.clearMessages(testItemID);
      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 0);
    });

    it("should not affect messages of other items", async function () {
      const otherItemID = 888888;
      await storage.saveMessage(testItemID, "user", "Test item message");
      await storage.saveMessage(otherItemID, "user", "Other item message");

      await storage.clearMessages(testItemID);

      const testMessages = await storage.getMessages(testItemID);
      const otherMessages = await storage.getMessages(otherItemID);

      assert.lengthOf(testMessages, 0);
      assert.lengthOf(otherMessages, 1);

      // Clean up
      await storage.clearMessages(otherItemID);
    });
  });

  describe("deleteOldestMessages", function () {
    it("should delete the oldest N messages", async function () {
      await storage.saveMessage(testItemID, "user", "Message 1");
      await storage.saveMessage(testItemID, "assistant", "Message 2");
      await storage.saveMessage(testItemID, "user", "Message 3");
      await storage.saveMessage(testItemID, "assistant", "Message 4");

      await storage.deleteOldestMessages(testItemID, 2);
      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 2);
      assert.equal(messages[0].content, "Message 3");
      assert.equal(messages[1].content, "Message 4");
    });

    it("should handle deleting more messages than exist", async function () {
      await storage.saveMessage(testItemID, "user", "Only message");

      await storage.deleteOldestMessages(testItemID, 10);
      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 0);
    });

    it("should handle deleting zero messages", async function () {
      await storage.saveMessage(testItemID, "user", "Message 1");
      await storage.saveMessage(testItemID, "assistant", "Message 2");

      await storage.deleteOldestMessages(testItemID, 0);
      const messages = await storage.getMessages(testItemID);

      assert.lengthOf(messages, 2);
    });
  });

  describe("settings", function () {
    const testKey = "test_setting_key";

    afterEach(async function () {
      // Clean up test setting
      await storage.saveSetting(testKey, "");
    });

    it("should save and retrieve a setting", async function () {
      await storage.saveSetting(testKey, "test_value");
      const value = await storage.getSetting(testKey);

      assert.equal(value, "test_value");
    });

    it("should update existing setting", async function () {
      await storage.saveSetting(testKey, "initial_value");
      await storage.saveSetting(testKey, "updated_value");

      const value = await storage.getSetting(testKey);
      assert.equal(value, "updated_value");
    });

    it("should return null for non-existent setting", async function () {
      const value = await storage.getSetting("non_existent_key_12345");
      assert.isNull(value);
    });
  });
});
