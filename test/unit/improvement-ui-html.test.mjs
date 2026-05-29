import { test } from "node:test";
import { strictEqual } from "node:assert/strict";
import { buildSelectOptions } from "../../scripts/improvement/ui-html.js";

test("buildSelectOptions escapes labels and values", () => {
  const html = buildSelectOptions([
    { value: "actor\"id", label: "<img src=x onerror=alert(1)>" },
  ]);

  strictEqual(
    html,
    "<option value=\"actor&quot;id\">&lt;img src=x onerror=alert(1)&gt;</option>"
  );
});
