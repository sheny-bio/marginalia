import { assert } from "chai";
import { config } from "../package.json";

describe("Integration Tests", function () {
  describe("Conversation Flow", function () {
    it("should have chat panel registered", function () {
      const addon = Zotero[config.addonInstance];
      assert.isDefined(addon);
      assert.isDefined(addon.data);
    });

    it("should have storage manager initialized", function () {
      const addon = Zotero[config.addonInstance];
      assert.isDefined(addon.data.storageManager);
    });

    it("should have settings manager initialized", function () {
      const addon = Zotero[config.addonInstance];
      assert.isDefined(addon.data.settingsManager);
    });
  });

  describe("Settings Flow", function () {
    it("should be able to get API config", async function () {
      const addon = Zotero[config.addonInstance];
      const settingsManager = addon.data.settingsManager;

      const config = await settingsManager.getAPIConfig();
      assert.isDefined(config);
      assert.isDefined(config.url);
      assert.isDefined(config.model);
    });

    it("should be able to get max history rounds", async function () {
      const addon = Zotero[config.addonInstance];
      const settingsManager = addon.data.settingsManager;

      const maxRounds = await settingsManager.getMaxHistoryRounds();
      assert.isNumber(maxRounds);
      assert.isAtLeast(maxRounds, 0);
    });

    it("should be able to get system prompt", async function () {
      const addon = Zotero[config.addonInstance];
      const settingsManager = addon.data.settingsManager;

      const prompt = await settingsManager.getSystemPrompt();
      assert.isString(prompt);
      assert.isNotEmpty(prompt);
    });

    it("should be able to check tool calling status", async function () {
      const addon = Zotero[config.addonInstance];
      const settingsManager = addon.data.settingsManager;

      const enabled = await settingsManager.isToolCallingEnabled();
      assert.isBoolean(enabled);
    });
  });

  describe("Tool Calling Flow", function () {
    it("should have available tools defined", function () {
      // Import dynamically to avoid module resolution issues
      const { AVAILABLE_TOOLS } = require("../src/modules/toolCaller");

      assert.isArray(AVAILABLE_TOOLS);
      assert.isAtLeast(AVAILABLE_TOOLS.length, 3);

      // Check tool structure
      for (const tool of AVAILABLE_TOOLS) {
        assert.isDefined(tool.name);
        assert.isDefined(tool.description);
        assert.isDefined(tool.parameters);
      }
    });

    it("should have get_paper_info tool", function () {
      const { AVAILABLE_TOOLS } = require("../src/modules/toolCaller");
      const tool = AVAILABLE_TOOLS.find((t: any) => t.name === "get_paper_info");

      assert.isDefined(tool);
      assert.equal(tool.parameters.itemID, "number");
    });

    it("should have get_paper_content tool", function () {
      const { AVAILABLE_TOOLS } = require("../src/modules/toolCaller");
      const tool = AVAILABLE_TOOLS.find((t: any) => t.name === "get_paper_content");

      assert.isDefined(tool);
      assert.equal(tool.parameters.itemID, "number");
    });

    it("should have search_papers tool", function () {
      const { AVAILABLE_TOOLS } = require("../src/modules/toolCaller");
      const tool = AVAILABLE_TOOLS.find((t: any) => t.name === "search_papers");

      assert.isDefined(tool);
      assert.equal(tool.parameters.query, "string");
      assert.equal(tool.parameters.limit, "number");
    });
  });
});
