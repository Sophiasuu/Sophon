import { describe, it, expect } from "vitest";
import { classifyIntent } from "../src/core/intent";

describe("classifyIntent", () => {
  it("classifies commercial intent", () => {
    const result = classifyIntent("crm pricing plans");
    expect(result.intent).toBe("commercial");
    expect(result.priority).toBe(92);
    expect(result.action).toBe("keep");
  });

  it("classifies comparison intent", () => {
    const result = classifyIntent("salesforce alternatives");
    expect(result.intent).toBe("comparison");
    expect(result.priority).toBe(88);
    expect(result.action).toBe("keep");
  });

  it("classifies segmented intent", () => {
    const result = classifyIntent("crm for startups");
    expect(result.intent).toBe("segmented");
    expect(result.priority).toBe(80);
    expect(result.action).toBe("review");
  });

  it("classifies informational intent", () => {
    const result = classifyIntent("what is crm");
    expect(result.intent).toBe("informational");
    expect(result.priority).toBe(70);
    expect(result.action).toBe("review");
  });

  it("defaults to informational for unmatched input", () => {
    const result = classifyIntent("crm software");
    expect(result.intent).toBe("informational");
    expect(result.priority).toBe(65);
    expect(result.confidence).toBe(0.68);
    expect(result.action).toBe("review");
  });

  it("detects 'vs' as comparison", () => {
    const result = classifyIntent("hubspot vs salesforce");
    expect(result.intent).toBe("comparison");
  });

  it("detects 'cost' as commercial", () => {
    const result = classifyIntent("crm cost per user");
    expect(result.intent).toBe("commercial");
  });

  it("detects 'how to' as informational", () => {
    const result = classifyIntent("how to choose a crm");
    expect(result.intent).toBe("informational");
    expect(result.priority).toBe(70);
  });

  it("detects 'for enterprises' as segmented", () => {
    const result = classifyIntent("crm for enterprises");
    expect(result.intent).toBe("segmented");
  });
});
