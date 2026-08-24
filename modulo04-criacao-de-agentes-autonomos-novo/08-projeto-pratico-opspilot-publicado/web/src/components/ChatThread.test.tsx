import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatThread } from "./ChatThread";

describe("ChatThread", () => {
  it("renders empty state when there are no turns", () => {
    render(<ChatThread turns={[]} />);
    expect(screen.getByText("Nenhuma mensagem ainda")).toBeInTheDocument();
  });
});
