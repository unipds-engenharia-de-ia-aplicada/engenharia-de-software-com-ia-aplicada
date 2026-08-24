import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("./api/client", async () => {
  const actual = await vi.importActual<typeof import("./api/client")>("./api/client");
  return {
    ...actual,
    postChat: vi.fn(),
    postApproval: vi.fn(),
  };
});

import { postChat, postApproval, ApiClientError } from "./api/client";

describe("App", () => {
  beforeEach(() => {
    vi.mocked(postChat).mockReset();
    vi.mocked(postApproval).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows inline error with retry when postChat fails", async () => {
    const user = userEvent.setup();
    vi.mocked(postChat).mockRejectedValue(
      new ApiClientError("Não foi possível falar com a API"),
    );

    render(<App />);
    await user.type(screen.getByLabelText("Mensagem"), "oi");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Não foi possível falar com a API")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });

  it("renders approval card on 202 and blocks composer", async () => {
    const user = userEvent.setup();
    vi.mocked(postChat).mockResolvedValue({
      kind: "pending",
      status: 202,
      data: {
        requestId: "11111111-1111-4111-8111-111111111111",
        conversationId: null,
        pending: {
          approvalId: "22222222-2222-4222-8222-222222222222",
          summary: "abrir incidente",
          createdAt: Date.now(),
        },
      },
    });

    render(<App />);
    await user.click(screen.getByLabelText("Exigir aprovação"));
    await user.type(screen.getByLabelText("Mensagem"), "abrir incidente crítico");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Ação pendente")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem")).toBeDisabled();
  });

  it("opens reasoning drawer for assistant trace", async () => {
    const user = userEvent.setup();
    vi.mocked(postChat).mockResolvedValue({
      kind: "success",
      status: 200,
      data: {
        requestId: "11111111-1111-4111-8111-111111111111",
        answer: "ok",
        conversationId: "33333333-3333-4333-8333-333333333333",
        trace: [
          { type: "thought", content: "pensar", node: "react" },
          { type: "answer", content: "ok", node: "react" },
        ],
      },
    });

    render(<App />);
    await user.type(screen.getByLabelText("Mensagem"), "status");
    await user.click(screen.getByRole("button", { name: "Enviar" }));

    await waitFor(() => expect(screen.getByText("ok")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Ver raciocínio" }));
    expect(screen.getByRole("dialog", { name: "Raciocínio" })).toBeInTheDocument();
    expect(screen.getByText("thought")).toBeInTheDocument();
  });
});
