import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApprovalCard } from "./ApprovalCard";

describe("ApprovalCard", () => {
  it("invokes approve and deny", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    const onDeny = vi.fn();
    render(
      <ApprovalCard
        summary="ação"
        status="pending"
        onApprove={onApprove}
        onDeny={onDeny}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Aprovar" }));
    await user.click(screen.getByRole("button", { name: "Negar" }));
    expect(onApprove).toHaveBeenCalled();
    expect(onDeny).toHaveBeenCalled();
  });
});
