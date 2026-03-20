import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "./SummaryCard";

describe("SummaryCard", () => {
  it("renders title and currency value", () => {
    render(<SummaryCard title="Balance" value={45000} />);
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText(/45,000/)).toBeInTheDocument();
  });
});
