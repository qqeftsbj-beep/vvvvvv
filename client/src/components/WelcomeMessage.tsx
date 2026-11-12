import React, { useEffect, useState } from "react";
import OwnerModal from "./OwnerModal";
import "./WelcomeMessage.css";

export const WELCOME_SESSION_KEY = "abu-kayan-welcome-seen-session-v1";
// Only a defensive fallback when browser storage is disabled; no owner keys are used.
let seenWithoutStorage = false;

function claimSession() {
  try {
    if (window.sessionStorage.getItem(WELCOME_SESSION_KEY) === "1") return false;
    // Mark on display, not on dismissal, so refreshing an open message cannot repeat it.
    window.sessionStorage.setItem(WELCOME_SESSION_KEY, "1");
    return true;
  } catch {
    if (seenWithoutStorage) return false;
    seenWithoutStorage = true;
    return true;
  }
}

export default function WelcomeMessage({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const privateRoute = pathname === "/owner" || pathname.startsWith("/owner/");
  useEffect(() => {
    if (privateRoute) { setOpen(false); return; }
    if (claimSession()) setOpen(true);
  }, [privateRoute]);

  return <OwnerModal open={open && !privateRoute} onClose={() => setOpen(false)} title="أهلًا بك في أبو كيان الجنيد" ariaLabel="الرسالة الترحيبية" className="welcome-message">
    <p className="welcome-message-intro">مساحتك للأفكار والتصاميم والإبداع.</p>
    <p>تصفّح التصاميم والأدوات المجانية، واكتشف مشاريع المبدعين وخدمات الاستوديو. يسعدنا وجودك معنا.</p>
    <button type="button" className="welcome-message-continue" onClick={() => setOpen(false)}>ابدأ التصفح</button>
  </OwnerModal>;
}
