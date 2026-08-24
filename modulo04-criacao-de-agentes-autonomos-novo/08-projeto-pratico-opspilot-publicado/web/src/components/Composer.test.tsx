import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("calls onSend with message on submit", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <Composer
        awaitHumanApproval={false}
        onAwaitHumanApprovalChange={() => undefined}
        onSend={onSend}
      />,
    );

    await user.type(screen.getByLabelText("Mensagem"), "liste alertas");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSend).toHaveBeenCalledWith("liste alertas");
  });
});
