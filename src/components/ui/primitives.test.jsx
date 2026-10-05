import { Clock } from "lucide-react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "../../test/utils";
import { Badge, Button, Card, Field, Input, Select, Table, TBody, Td, Th, THead, Tr, inputBaseClass, inputClass } from "./index";

describe("Button", () => {
  it("is type=button by default, so it never submits a form by accident", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "button");
  });

  it("can be a submit button", () => {
    render(<Button type="submit">Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("type", "submit");
  });

  it.each([
    ["primary", "bg-navy"],
    ["gold", "bg-gold"],
    ["secondary", "border-slate-200"],
    ["ghost", "text-slate-500"],
    ["danger", "text-av-red"],
  ])("the %s variant uses the brand tokens (%s)", (variant, cls) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole("button")).toHaveClass(cls);
  });

  it("loading disables it and marks it busy, and it does not fire", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("passes everything else through: onClick, aria-label, a ref, extra classes", async () => {
    const onClick = vi.fn();
    const ref = createRef();
    render(<Button ref={ref} onClick={onClick} aria-label="Close" className="ml-2" />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(ref.current).toBe(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveClass("ml-2");
  });
});

describe("Input, Select and Field", () => {
  it("an error turns the border red and sets aria-invalid; no error is the normal border", () => {
    const { rerender } = render(<Input aria-label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveClass("border-slate-200");
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
    rerender(<Input aria-label="Name" error="Required" />);
    expect(screen.getByLabelText("Name")).toHaveClass("border-av-red");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });

  it("inputBaseClass is a STRING (the constant for fields with no error state): passing the function by mistake would drop the styling", () => {
    expect(typeof inputBaseClass).toBe("string");
    expect(inputBaseClass).toBe(inputClass());
  });

  it("inputClass is the one class string the text fields share", () => {
    expect(inputClass()).toContain("focus:border-gold");
    expect(inputClass("bad")).toContain("border-av-red");
  });

  it("Select takes options as children and is styled like Input", async () => {
    render(
      <Select aria-label="Province" defaultValue="BC">
        <option value="AB">Alberta</option>
        <option value="BC">British Columbia</option>
      </Select>
    );
    const select = screen.getByLabelText("Province");
    expect(select).toHaveValue("BC");
    expect(select).toHaveClass("border-slate-200");
    await userEvent.selectOptions(select, "AB");
    expect(select).toHaveValue("AB");
  });

  it("Field ties its label to the control, marks required, and announces an error", () => {
    render(
      <Field label="First Name" required error="First name is required">
        <Input />
      </Field>
    );
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument(); // the label wraps the control
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("First name is required");
  });

  it("Field shows no alert without an error", () => {
    render(
      <Field label="Last Name">
        <Input />
      </Field>
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("Card and Badge", () => {
  it("Card is a white rounded card; `as` changes the element and padding is selectable", () => {
    const { container } = render(
      <Card as="section" padding="sm" aria-label="Plan">
        inside
      </Card>
    );
    const card = container.querySelector("section");
    expect(card).toHaveClass("rounded-2xl", "bg-white", "p-4");
    expect(card).toHaveAccessibleName("Plan");
  });

  it.each([
    ["green", "text-av-green"],
    ["amber", "text-av-amber"],
    ["red", "text-av-red"],
    ["blue", "text-av-blue"],
    ["purple", "text-av-purple"],
    ["slate", "text-slate-500"],
  ])("Badge tone %s", (tone, cls) => {
    render(<Badge tone={tone}>Label</Badge>);
    expect(screen.getByText("Label")).toHaveClass(cls);
  });

  it("an unknown tone falls back to neutral; an icon is decorative; sm is smaller", () => {
    render(
      <Badge tone="nope" size="sm" icon={Clock}>
        Pending
      </Badge>
    );
    const badge = screen.getByText("Pending");
    expect(badge).toHaveClass("text-slate-500", "text-[11px]");
    expect(badge.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Table", () => {
  it("is an accessible table: a caption for screen readers, column headers with scope, aligned cells", () => {
    render(
      <Table caption="Recent calls">
        <THead>
          <Tr>
            <Th>Feature</Th>
            <Th align="right">Credits</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td>Letter</Td>
            <Td align="right">5</Td>
          </Tr>
        </TBody>
      </Table>
    );
    expect(screen.getByRole("table", { name: "Recent calls" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Feature" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("columnheader", { name: "Credits" })).toHaveClass("text-right");
    expect(screen.getByRole("cell", { name: "5" })).toHaveClass("text-right");
  });
});
