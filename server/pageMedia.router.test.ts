import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";

const context = () => ({ user: null, req: { protocol: "https", headers: {} }, res: {} }) as never;
describe("page media procedures", () => {
  it("rejects unauthorized listing before touching stored media", async () => {
    await expect(appRouter.createCaller(context()).pageMedia.list({ ownerPin: "wrong", pageId: "page-one" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects unauthorized upload before reading or uploading the supplied bytes", async () => {
    await expect(appRouter.createCaller(context()).pageMedia.upload({ ownerPin: "wrong", pageId: "page-one", name: "x", folder: "", description: "", fileName: "not.txt", mimeType: "text/plain", data: "%%%=" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("validates authorized upload format before requiring storage", async () => {
    await expect(appRouter.createCaller(context()).pageMedia.upload({ ownerPin: ENV.ownerPin, pageId: "page-one", name: "x", folder: "", description: "", fileName: "x.html", mimeType: "text/html", data: Buffer.from("<html>").toString("base64") })).rejects.toMatchObject({ message: expect.stringContaining("not allowed") });
  });
});
