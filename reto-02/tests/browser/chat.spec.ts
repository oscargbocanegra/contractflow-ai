import { test, expect } from "@playwright/test";
const pending = {
  id: "pending-browser-case",
  mensajeId: "msg-006",
  fields: [
    "valor",
    "moneda",
    "fecha_inicio",
    "fecha_fin",
    "requiere_poliza",
    "estado_poliza",
  ],
  values: {
    valor: 0,
    moneda: "COP",
    fecha_inicio: null,
    fecha_fin: null,
    requiere_poliza: null,
    estado_poliza: null,
  },
};
const trace = {
  id: "test-call",
  name: "contratos_validar",
  arguments: { mensaje_id: "msg-006" },
  result: {
    ok: true,
    data: { clasificacion: "nuevo", requiere_revision: pending.fields },
  },
};
test("controlled HTTP fixture: visible tools, missing values and explicit human confirmation", async ({
  page,
}) => {
  let sessionId = "";
  let stage = 0;
  let approval: Record<string, unknown> | undefined;
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        provider: "controlled-test",
        model: "not-a-live-model",
        configured: true,
      },
    }),
  );
  await page.route("**/api/sessions/*", (route) =>
    stage === 1
      ? route.fulfill({
          json: {
            sessionId,
            messages: [
              { role: "user", content: "Process mailbox" },
              {
                role: "assistant",
                content: "Controlled fixture requires human review.",
              },
            ],
            toolCalls: [trace],
            tokensUsed: 150,
            needsConfirmation: true,
            pendingReview: pending,
            processing: false,
          },
        })
      : route.fulfill({
          status: 404,
          json: { ok: false, error: "No prior session" },
        }),
  );
  await page.route("**/api/chat", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sessionId = String(body.sessionId);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (stage === 0) {
      stage = 1;
      await route.fulfill({
        json: {
          sessionId,
          reply: "Controlled fixture requires human review.",
          toolCalls: [trace],
          needsConfirmation: true,
          pendingReview: pending,
          tokensUsed: 150,
        },
      });
    } else {
      approval = body;
      stage = 2;
      await route.fulfill({
        json: {
          sessionId,
          reply: "Controlled fixture: confirmed candidate registered.",
          toolCalls: [
            {
              ...trace,
              id: "confirmed-call",
              name: "contratos_registrar",
              result: {
                ok: true,
                data: { accion: "create", id_contrato: "CM-2026-03" },
              },
            },
          ],
          needsConfirmation: false,
          tokensUsed: 150,
        },
      });
    }
  });
  await page.goto("/");
  await page.getByLabel("Message", { exact: true }).fill("Process mailbox");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Thinking and checking tools…")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Human confirmation required" }),
  ).toBeVisible();
  await expect(page.getByLabel("fecha_inicio", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByLabel("fecha_fin", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("requiere_poliza", { exact: true })).toHaveValue(
    "",
  );
  await page.getByText("contratos_validar", { exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Arguments", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Result", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Human confirmation required" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("contractflow-session-id")),
  ).toBe(sessionId);
  await page.getByLabel("fecha_inicio", { exact: true }).fill("2026-09-01");
  await page.getByLabel("fecha_fin", { exact: true }).fill("2027-08-31");
  await page
    .getByLabel("requiere_poliza", { exact: true })
    .selectOption("false");
  await page
    .getByRole("button", { name: "Confirm these values and register" })
    .click();
  await expect(
    page.getByText("Controlled fixture: confirmed candidate registered.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Human confirmation required" }),
  ).toHaveCount(0);
  expect(approval).toMatchObject({
    sessionId,
    message: "Confirm these explicit human decisions",
    confirmation: {
      pendingId: pending.id,
      mensajeId: "msg-006",
      values: {
        valor: 0,
        moneda: "COP",
        fecha_inicio: "2026-09-01",
        fecha_fin: "2027-08-31",
        requiere_poliza: false,
      },
    },
  });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    "contractflow-session-id",
  ]);
});
test("controlled malformed response: fail closed and require history recovery", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        provider: "controlled-test",
        model: "test",
        configured: false,
      },
    }),
  );
  await page.route("**/api/sessions/*", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await page.route("**/api/chat", (route) =>
    route.fulfill({ json: { untrusted: "invalid shape" } }),
  );
  await page.goto("/");
  await page.getByLabel("Message", { exact: true }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("invalid response");
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Refresh history" }).click();
  await expect(
    page.getByRole("button", { name: "Send", exact: true }),
  ).toBeEnabled();
});
test("controlled text safety: provider content is text, never executable HTML", async ({
  page,
}) => {
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        provider: "controlled-test",
        model: "test",
        configured: false,
      },
    }),
  );
  await page.route("**/api/sessions/*", (route) =>
    route.fulfill({ status: 404, json: {} }),
  );
  await page.route("**/api/chat", (route) => {
    const body = route.request().postDataJSON() as { sessionId: string };
    return route.fulfill({
      json: {
        sessionId: body.sessionId,
        reply: '<img src=x onerror="window.contractflowXss=true">',
        toolCalls: [],
        needsConfirmation: false,
        tokensUsed: 0,
      },
    });
  });
  await page.goto("/");
  await page.getByLabel("Message", { exact: true }).fill("Hello");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText('<img src=x onerror="window.contractflowXss=true">', {
      exact: true,
    }),
  ).toBeVisible();
  expect(await page.locator("img").count()).toBe(0);
});
test("real local frontend + backend: missing-key error is honest and session survives", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByText(/not configured: backend API key required/),
  ).toBeVisible();
  await page
    .getByLabel("Message", { exact: true })
    .fill("Process mailbox with reference date 2026-09-03");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("not configured");
  await expect(
    page.getByRole("region", { name: "Conversation" }),
  ).toContainText("OPENAI_API_KEY");
  const session = await page.evaluate(() =>
    localStorage.getItem("contractflow-session-id"),
  );
  const history = await page.request.get(`/api/sessions/${session}`);
  expect(history.status()).toBe(200);
  expect(
    ((await history.json()) as { messages: unknown[] }).messages.length,
  ).toBeGreaterThan(1);
  await page.screenshot({ path: "out/g4-chat-local.png", fullPage: true });
});
