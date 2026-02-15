import { assert } from "chai";
import { ToolCaller } from "../src/modules/toolCaller";

describe("ToolCaller", function () {
  describe("parseToolCalls", function () {
    it("should parse a single valid tool call", function () {
      const content = `
        <tool_call>
          <name>get_paper_info</name>
          <arguments>{"itemID": 123}</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 1);
      assert.equal(result[0].name, "get_paper_info");
      assert.deepEqual(result[0].arguments, { itemID: 123 });
    });

    it("should parse multiple tool calls", function () {
      const content = `
        <tool_call>
          <name>get_paper_info</name>
          <arguments>{"itemID": 123}</arguments>
        </tool_call>
        <tool_call>
          <name>search_papers</name>
          <arguments>{"query": "machine learning", "limit": 5}</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 2);
      assert.equal(result[0].name, "get_paper_info");
      assert.equal(result[1].name, "search_papers");
      assert.equal(result[1].arguments.query, "machine learning");
      assert.equal(result[1].arguments.limit, 5);
    });

    it("should return empty array for content without tool calls", function () {
      const content = "This is just regular text without any tool calls.";
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 0);
    });

    it("should return empty array for empty content", function () {
      const result = ToolCaller.parseToolCalls("");
      assert.lengthOf(result, 0);
    });

    it("should skip malformed tool calls with missing name", function () {
      const content = `
        <tool_call>
          <arguments>{"itemID": 123}</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 0);
    });

    it("should skip malformed tool calls with missing arguments", function () {
      const content = `
        <tool_call>
          <name>get_paper_info</name>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 0);
    });

    it("should skip tool calls with invalid JSON arguments", function () {
      const content = `
        <tool_call>
          <name>get_paper_info</name>
          <arguments>{invalid json}</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 0);
    });

    it("should parse valid tool calls and skip invalid ones", function () {
      const content = `
        <tool_call>
          <name>get_paper_info</name>
          <arguments>{"itemID": 123}</arguments>
        </tool_call>
        <tool_call>
          <name>invalid</name>
          <arguments>{bad json}</arguments>
        </tool_call>
        <tool_call>
          <name>search_papers</name>
          <arguments>{"query": "test"}</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 2);
      assert.equal(result[0].name, "get_paper_info");
      assert.equal(result[1].name, "search_papers");
    });

    it("should handle tool calls with multiline arguments", function () {
      const content = `
        <tool_call>
          <name>search_papers</name>
          <arguments>{
            "query": "deep learning",
            "limit": 10
          }</arguments>
        </tool_call>
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 1);
      assert.equal(result[0].arguments.query, "deep learning");
      assert.equal(result[0].arguments.limit, 10);
    });

    it("should handle tool calls embedded in other text", function () {
      const content = `
        Let me search for papers about this topic.
        <tool_call>
          <name>search_papers</name>
          <arguments>{"query": "neural networks"}</arguments>
        </tool_call>
        I found some relevant papers.
      `;
      const result = ToolCaller.parseToolCalls(content);
      assert.lengthOf(result, 1);
      assert.equal(result[0].name, "search_papers");
    });
  });
});
