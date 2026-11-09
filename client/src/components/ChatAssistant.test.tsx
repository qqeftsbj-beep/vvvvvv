// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendAsync } = vi.hoisted(() => ({ sendAsync: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { customerInbox: { send: { useMutation: () => ({ mutateAsync: sendAsync, isPending: false }) } } },
}));

import ChatAssistant from "./ChatAssistant";

function enterContactRequest() {
  fireEvent.click(screen.getByRole("button", { name: "بدء محادثة" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "أريد التواصل" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "سارة" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "+967771234567" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "أحتاج تصميم هوية" } });
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
}

describe("ChatAssistant durable submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.crypto.randomUUID = vi.fn(() => "stable-request-id") as unknown as typeof window.crypto.randomUUID;
  });
  afterEach(() => cleanup());

  it("uses one stable id, waits for server success, and says server saved", async () => {
    sendAsync.mockResolvedValue({ success: true, id: "stable-request-id" });
    render(<ChatAssistant />);
    enterContactRequest();

    await waitFor(() => expect(sendAsync).toHaveBeenCalledTimes(1));
    expect(sendAsync).toHaveBeenCalledWith({
      id: "stable-request-id",
      name: "سارة",
      phone: "+967771234567",
      request: "أحتاج تصميم هوية",
      source: "المحادثة التجريبية",
    });
    expect(await screen.findByText("حُفظ الطلب في خادم الموقع")).toBeTruthy();
    expect(screen.getByText("عند نجاح الحفظ تُخزّن بياناتك في خادم الموقع فقط، ولا تُرسل إلى واتساب.")).toBeTruthy();
    expect(window.localStorage.getItem("abu-kayan-inbox-pending")).toBeNull();
  });

  it("keeps a failed payload local and retries the same id without claiming delivery", async () => {
    sendAsync.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ success: true, id: "stable-request-id" });
    render(<ChatAssistant />);
    enterContactRequest();

    await waitFor(() => expect(sendAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/لم يصل الطلب إلى المالك بعد/)).toBeTruthy();
    expect(screen.getByText(/حُفظت نسخة على جهازك فقط/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem("abu-kayan-inbox-pending") || "null")).toMatchObject({ id: "stable-request-id", request: "أحتاج تصميم هوية" });

    fireEvent.click(screen.getByRole("button", { name: /إعادة المحاولة/ }));
    await waitFor(() => expect(sendAsync).toHaveBeenCalledTimes(2));
    expect(sendAsync.mock.calls[1][0].id).toBe("stable-request-id");
    expect(await screen.findByText("حُفظ الطلب في خادم الموقع")).toBeTruthy();
    expect(window.localStorage.getItem("abu-kayan-inbox-pending")).toBeNull();
  });
});
