import { describe, expect, it } from "bun:test";
import {
  getModelCatalog,
  getDefaultModelSelection,
  findModel,
} from "../catalog-parser";

describe("getModelCatalog", () => {
  it("returns a non-empty list of providers", () => {
    const providers = getModelCatalog();
    expect(providers.length).toBeGreaterThan(0);
  });

  it("each provider has an id, name, and at least one model", () => {
    const providers = getModelCatalog();
    for (const provider of providers) {
      expect(provider.id).toBeTruthy();
      expect(provider.name).toBeTruthy();
      expect(provider.models.length).toBeGreaterThan(0);
    }
  });
});

describe("getDefaultModelSelection", () => {
  it("returns a valid model selection", () => {
    const selection = getDefaultModelSelection();
    expect(selection.providerId).toBeTruthy();
    expect(selection.modelId).toBeTruthy();
    expect(["none", "low", "medium", "high"]).toContain(
      selection.reasoningBudget,
    );
  });

  it("default model exists in the catalog", () => {
    const selection = getDefaultModelSelection();
    const model = findModel(selection.providerId, selection.modelId);
    expect(model).toBeDefined();
  });
});

describe("findModel", () => {
  it("finds a model that exists", () => {
    const selection = getDefaultModelSelection();
    const model = findModel(selection.providerId, selection.modelId);
    expect(model).toBeDefined();
    expect(model!.id).toBe(selection.modelId);
  });

  it("returns undefined for non-existent model", () => {
    const model = findModel("no-such-provider", "no-such-model");
    expect(model).toBeUndefined();
  });

  it("returns undefined for existing provider but wrong model", () => {
    const selection = getDefaultModelSelection();
    const model = findModel(selection.providerId, "nonexistent-model-id");
    expect(model).toBeUndefined();
  });
});
