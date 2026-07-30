import { describe, it, expect, vi, beforeEach } from "vitest";
import { planAssistantToolCall } from "../services/ai.js";
import * as settings from "../services/settings.js";

vi.mock("../services/settings.js", () => {
  return {
    getAiSettings: vi.fn(() => ({ aiLanguage: "zh-CN" })),
    getActiveAiConfig: vi.fn(() => ({
      provider: {
        apiFormat: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test_key",
        temperature: 0.7
      },
      model: {
        name: "gpt-4o",
        maxTokens: 4096,
        supportsVision: true
      }
    }))
  };
});

describe("ai.ts", () => {
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url, options) => {
      // return a fake successful response
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  tool: "create_bookmark",
                  arguments: { url: "https://example.com" },
                  confidence: 0.9,
                  requiresConfirmation: false,
                  reason: "用户想保存网页"
                })
              }
            }
          ]
        }),
        text: async () => "dummy text"
      } as any;
    });
  });

  describe("planAssistantToolCall", () => {
    it("should parse tool call plan from AI response", async () => {
      const plan = await planAssistantToolCall({
        message: "帮我保存一下 https://example.com",
        categories: ["未分类"],
        bookmarkHints: [],
        webSearchEnabled: false
      });

      expect(fetchMock).toHaveBeenCalled();
      expect(plan).not.toBeNull();
      expect(plan?.tool).toBe("create_bookmark");
      expect(plan?.arguments).toEqual({ url: "https://example.com" });
      expect(plan?.confidence).toBe(0.9);
      expect(plan?.reason).toBe("用户想保存网页");
    });

    it("should return null if invalid tool is returned", async () => {
      fetchMock.mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    tool: "invalid_tool",
                    arguments: {},
                    confidence: 0.5,
                    reason: "test"
                  })
                }
              }
            ]
          })
        } as any;
      });

      const plan = await planAssistantToolCall({
        message: "test invalid",
        categories: [],
        bookmarkHints: [],
        webSearchEnabled: false
      });

      expect(plan).toBeNull();
    });
    
    it("should handle invalid JSON robustly", async () => {
      fetchMock.mockImplementationOnce(async () => {
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                message: {
                  content: "I am not a JSON object { broken json"
                }
              }
            ]
          })
        } as any;
      });

      const plan = await planAssistantToolCall({
        message: "test invalid json",
        categories: [],
        bookmarkHints: [],
        webSearchEnabled: false
      });

      // parse is robust, returns null on throw
      expect(plan).not.toBeNull();
      expect(plan?.tool).toBe("none");
    });
  });
});
