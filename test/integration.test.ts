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
  });
});
