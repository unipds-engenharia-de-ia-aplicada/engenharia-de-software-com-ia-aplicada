import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsGear } from "./SettingsGear";

describe("SettingsGear", () => {
  it("shows field error and does not save invalid URL", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <SettingsGear
        open
        apiBaseUrl="http://localhost:3000"
        onOpen={() => undefined}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );

    const input = screen.getByLabelText("URL da API");
    await user.clear(input);
    await user.type(input, "not-a-url");
    await user.click(screen.getByRole("button", { name: "Salvar" }));

    expect(screen.getByRole("alert")).toHaveTextContent(/URL/i);
    expect(onSave).not.toHaveBeenCalled();
  });
});
