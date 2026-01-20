import test from "node:test";
import assert from "node:assert/strict";
import { apiKeyHasScope } from "../middleware/requireScope.js";

test("apiKeyHasScope allows all when scopes unset", () => {
  assert.equal(apiKeyHasScope(null, "pbi.export"), true);
});

test("apiKeyHasScope blocks missing scopes", () => {
  assert.equal(apiKeyHasScope(["pbi.verify"], "pbi.export"), false);
});

test("apiKeyHasScope allows explicit scope", () => {
  assert.equal(apiKeyHasScope(["pbi.export"], "pbi.export"), true);
});
