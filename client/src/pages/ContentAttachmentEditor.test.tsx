// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { upload, busy } = vi.hoisted(() => ({ upload: vi.fn(), busy: vi.fn() }));
const stored = { id: "media-1", pageId: "free-sites:stable-id", name: "guide", originalName: "guide.pdf", folder: "", description: "", mimeType: "application/pdf", size: 8, url: "/media/guide", downloadUrl: "/api/page-media/media-1", key: "media/guide", createdAt: 1 };
vi.mock("@/lib/trpc", () => ({ trpc: { pageMedia: { upload: { useMutation: () => ({ mutateAsync: upload }) } } } }));
import ContentAttachmentEditor from "./ContentAttachmentEditor";

describe("ContentAttachmentEditor", () => {
  afterEach(() => cleanup());
  beforeEach(() => { upload.mockReset().mockResolvedValue(stored); busy.mockReset(); });

  it("keeps attachments optional and renders no empty preview cards", () => {
    const { container } = render(<ContentAttachmentEditor attachments={[]} onChange={vi.fn()} ownerPin="1234" pageId="free-sites:stable-id" />);
    expect(screen.getByText(/يمكنك الحفظ دون أي مرفقات/)).toBeTruthy();
    expect(container.querySelectorAll(".content-attachment-editor-item")).toHaveLength(0);
  });

  it("uploads a file to a stable per-item namespace and saves returned metadata only", async () => {
    const onChange = vi.fn();
    render(<ContentAttachmentEditor attachments={[]} onChange={onChange} ownerPin="1234" pageId="free-sites:stable-id" onBusyChange={busy} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["pdf"], "guide.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(upload).toHaveBeenCalled());
    const args = upload.mock.calls[0][0];
    expect(args).toMatchObject({ ownerPin: "1234", pageId: "free-sites:stable-id", name: "guide", fileName: "guide.pdf", mimeType: "application/pdf" });
    expect(args.data).toBe("cGRm");
    expect(args).not.toHaveProperty("attachments");
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([stored]));
    expect(busy).toHaveBeenNthCalledWith(1, true);
    expect(busy).toHaveBeenLastCalledWith(false);
  });
});
