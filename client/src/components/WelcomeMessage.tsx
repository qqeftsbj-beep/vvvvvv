import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { WelcomeTemplate } from "@shared/welcomeSchedule";
import WelcomeDialog from "./WelcomeDialog";

export const WELCOME_SESSION_KEY = "abu-kayan-welcome-seen-session-v1";
let seenWithoutStorage = false;
function hasSeen() {
  try { return window.sessionStorage.getItem(WELCOME_SESSION_KEY) === "1"; }
  catch { return seenWithoutStorage; }
}
function claimSession() {
  if (hasSeen()) return false;
  try { window.sessionStorage.setItem(WELCOME_SESSION_KEY, "1"); }
  catch { seenWithoutStorage = true; }
  return true;
}

export default function WelcomeMessage({ pathname }: { pathname: string }) {
  const [template, setTemplate] = useState<WelcomeTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const privateRoute = pathname === "/owner" || pathname.startsWith("/owner/");
  // Wait for the server's selection; don't flash the default before reading the owner's settings.
  const active = trpc.welcome.active.useQuery(undefined, { enabled: !privateRoute && !hasSeen(), staleTime: 0, refetchOnWindowFocus: true, retry: 1 });
  useEffect(() => {
    if (privateRoute) { setOpen(false); return; }
    if (active.data?.template && claimSession()) { setTemplate(active.data.template); setOpen(true); }
  }, [privateRoute, active.data]);

  return template ? <WelcomeDialog template={template} open={open && !privateRoute} onClose={() => setOpen(false)} /> : null;
}
