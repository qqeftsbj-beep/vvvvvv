// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WelcomeMessage from "./WelcomeMessage";

vi.mock("@/lib/trpc", async () => {
  const { defaultWelcomeConfig } = await import("@shared/welcomeSchedule");
  return { trpc: { welcome: { active: { useQuery: () => ({ data: { template: defaultWelcomeConfig.templates[0] } }) } } } };
});

const WELCOME_SESSION_KEY = "abu-kayan-welcome-seen-session-v1";
const OTHER_SESSION_KEY = "welcome-message-test-unrelated";
const OTHER_LOCAL_KEY = "welcome-message-test-local-unrelated";

const dialogName = "الرسالة الترحيبية";
const title = "أهلًا بك في أبو كيان الجنيد";
const closeName = "إغلاق أهلًا بك في أبو كيان الجنيد";

function expectWelcomeVisible() {
  expect(screen.getByRole("dialog", { name: dialogName })).toBeTruthy();
  expect(screen.getByRole("heading", { name: title })).toBeTruthy();
}

beforeEach(() => {
  sessionStorage.removeItem(WELCOME_SESSION_KEY);
  sessionStorage.setItem(OTHER_SESSION_KEY, "keep-session");
  localStorage.setItem(OTHER_LOCAL_KEY, "keep-local");
});

afterEach(() => {
  cleanup();
  sessionStorage.removeItem(WELCOME_SESSION_KEY);
  sessionStorage.removeItem(OTHER_SESSION_KEY);
  localStorage.removeItem(OTHER_LOCAL_KEY);
});

describe("WelcomeMessage", () => {
  it("shows the welcome dialog once on a public route and records the session only when browsing starts", async () => {
    render(<WelcomeMessage pathname="/" />);

    await waitFor(expectWelcomeVisible);
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "ابدأ التصفح" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ابدأ التصفح" }));

    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
    expect(sessionStorage.getItem(OTHER_SESSION_KEY)).toBe("keep-session");
    expect(localStorage.getItem(OTHER_LOCAL_KEY)).toBe("keep-local");
  });

  it("does not consume the session on owner routes, but shows after moving to a public route", async () => {
    const view = render(<WelcomeMessage pathname="/owner" />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull());
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBeNull();

    view.rerender(<WelcomeMessage pathname="/owner/settings" />);
    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBeNull();

    view.rerender(<WelcomeMessage pathname="/templates" />);
    await waitFor(expectWelcomeVisible);
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
  });

  it("does not redisplay after a refresh in the same session, and redisplays after the key is cleared", async () => {
    const first = render(<WelcomeMessage pathname="/about" />);
    await waitFor(expectWelcomeVisible);
    fireEvent.click(screen.getByRole("button", { name: "ابدأ التصفح" }));
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
    first.unmount();

    render(<WelcomeMessage pathname="/about" />);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull());

    sessionStorage.removeItem(WELCOME_SESSION_KEY);
    cleanup();
    render(<WelcomeMessage pathname="/about" />);
    await waitFor(expectWelcomeVisible);
  });

  it("dismisses from X, backdrop, and Escape while preserving the session marker", async () => {
    const view = render(<WelcomeMessage pathname="/" />);
    await waitFor(expectWelcomeVisible);
    fireEvent.click(screen.getByRole("button", { name: closeName }));
    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");

    view.unmount();
    sessionStorage.removeItem(WELCOME_SESSION_KEY);
    const backdropView = render(<WelcomeMessage pathname="/" />);
    await waitFor(expectWelcomeVisible);
    const dialog = screen.getByRole("dialog", { name: dialogName });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");

    backdropView.unmount();
    sessionStorage.removeItem(WELCOME_SESSION_KEY);
    render(<WelcomeMessage pathname="/" />);
    await waitFor(expectWelcomeVisible);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
  });

  it("does not dismiss when clicking inside the dialog", async () => {
    render(<WelcomeMessage pathname="/" />);
    await waitFor(expectWelcomeVisible);
    const dialog = screen.getByRole("dialog", { name: dialogName });

    fireEvent.mouseDown(dialog);
    fireEvent.click(screen.getByRole("heading", { name: title }));

    expect(screen.getByRole("dialog", { name: dialogName })).toBeTruthy();
    expect(sessionStorage.getItem(WELCOME_SESSION_KEY)).toBe("1");
  });
});
