import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TraceDrawer } from "./TraceDrawer";

describe("TraceDrawer", () => {
  it("lists typed events", () => {
    render(
      <TraceDrawer
        open
        onClose={() => undefined}
        events={[
          { type: "action", content: "list_alerts", node: "react", tool: "list_alerts" },
        ]}
      />,
    );
    expect(screen.getByText("action")).toBeInTheDocument();
    expect(screen.getByText("list_alerts")).toBeInTheDocument();
    expect(screen.getByText("nó: react")).toBeInTheDocument();
  });

  it("renders handoff events with destination and brief", () => {
    render(
      <TraceDrawer
        open
        onClose={() => undefined}
        events={[
          {
            type: "handoff",
            content: "levante os fatos do checkout",
            node: "supervisor",
            to: "analista",
          },
          { type: "observation", content: "alerta critical", node: "analista" },
        ]}
      />,
    );
    expect(screen.getByText("handoff")).toBeInTheDocument();
    expect(screen.getByText("para: analista")).toBeInTheDocument();
    expect(screen.getByText("levante os fatos do checkout")).toBeInTheDocument();
    expect(screen.getByText("nó: supervisor")).toBeInTheDocument();
    expect(screen.getByText("alerta critical")).toBeInTheDocument();
  });

  it("shows empty state and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TraceDrawer open events={[]} onClose={onClose} />);
    expect(screen.getByText("Sem eventos de raciocínio")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
