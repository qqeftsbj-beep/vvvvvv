/*
  Design reminder — Luxury concierge chat:
  Fixed but calm, warm gold trigger, clear Arabic RTL messages, and no external transmission.
*/

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Bot, Check, MessageCircle, RefreshCw, Send, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import "./chatAssistant.css";

export type LeadStatus = "new" | "contacted" | "completed";

export type InboxLead = {
  id: string;
  name: string;
  phone: string;
  request: string;
  source: string;
  status: LeadStatus;
  createdAt: string;
};

type ChatMessage = { id: string; from: "assistant" | "user"; text: string };
type Stage = "idle" | "name" | "phone" | "request" | "done";
type SaveState = "idle" | "sending" | "saved" | "failed";

type SendInput = {
  id?: string;
  name: string;
  phone: string;
  request: string;
  source?: string;
};

type CustomerInboxClient = {
  customerInbox?: {
    send?: {
      useMutation: () => {
        mutateAsync: (input: SendInput) => Promise<{ success: true; id: string }>;
        isPending?: boolean;
      };
    };
  };
};

const INBOX_KEY = "abu-kayan-inbox";
const PENDING_KEY = "abu-kayan-inbox-pending";

function replyFor(text: string) {
  const normalized = text.toLowerCase();
  if (/السلام عليكم|سلام عليكم|مرحبا|مرحبًا|اهلا|أهلا|أهلًا/.test(normalized)) {
    return "وعليكم السلام ورحمة الله وبركاته. أهلًا بك في استوديو أبو كيان الجنيد، كيف يمكننا خدمتك؟";
  }
  if (/شكرا|شكرًا|ممتن/.test(normalized)) {
    return "العفو، يسعدنا خدمتك. اكتب أريد التواصل إذا رغبت بإرسال طلبك.";
  }
  if (/سعر|سعار|تكلفة|ميزانية|كم/.test(normalized)) {
    return "تختلف التكلفة حسب نوع الخدمة والتفاصيل المطلوبة. اكتب أريد التواصل وسأجمع بيانات طلبك للمتابعة.";
  }
  if (normalized.includes("إعلان") || normalized.includes("اعلان") || normalized.includes("فيس")) {
    return "نصمم الحملات الممولة برسالة واضحة، جمهور أدق، ومحتوى يساعد العميل على اتخاذ الخطوة التالية.";
  }
  if (normalized.includes("موقع") || normalized.includes("ويب") || normalized.includes("صفحة")) {
    return "ننشئ مواقع وصفحات هبوط عربية متجاوبة، مرتبة، وتشرح خدمتك بسرعة ووضوح.";
  }
  if (normalized.includes("عرس") || normalized.includes("تخرج") || normalized.includes("تهنئة") || normalized.includes("تصميم")) {
    return "نصمم صور المناسبات والتهاني بأسلوب خاص باسمك وألوانك، من الفكرة إلى الإخراج النهائي.";
  }
  return "أبو كيان الجنيد استوديو إبداعي في اليمن يقدم تصاميم المناسبات، الإعلانات الممولة، والمواقع وصفحات الهبوط. اسألني عن أي خدمة، أو اكتب: أريد التواصل.";
}

function readLocalLeads(): InboxLead[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(INBOX_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/** Keep the old local archive useful, but never create a duplicate for a retried id. */
function saveLead(lead: InboxLead) {
  const current = readLocalLeads();
  const next = [lead, ...current.filter((item) => item.id !== lead.id)];
  window.localStorage.setItem(INBOX_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("abu-kayan-inbox-updated"));
}

function savePending(lead: InboxLead) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(lead));
}

function clearPending(id: string) {
  try {
    const pending = JSON.parse(window.localStorage.getItem(PENDING_KEY) || "null") as Partial<InboxLead> | null;
    if (!pending || pending.id === id) window.localStorage.removeItem(PENDING_KEY);
  } catch {
    window.localStorage.removeItem(PENDING_KEY);
  }
}

function getSendMutation() {
  const client = trpc as unknown as CustomerInboxClient;
  return client.customerInbox?.send?.useMutation?.() ?? {
    isPending: false,
    mutateAsync: async () => {
      throw new Error("خدمة صندوق الرسائل غير متاحة الآن.");
    },
  };
}

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [lead, setLead] = useState<Partial<InboxLead>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const submittingRef = useRef(false);
  const sendMutation = getSendMutation();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", from: "assistant", text: "أهلًا بك. أنا مساعد أبو كيان التجريبي. اسألني عن خدمات التصاميم أو الإعلانات أو المواقع، وإذا رغبت بالتواصل سأجمع بيانات طلبك." },
  ]);

  useEffect(() => {
    if (open) window.setTimeout(() => document.getElementById("chat-input")?.focus(), 80);
  }, [open]);

  const addAssistant = (text: string) => setMessages((current) => [...current, { id: `${Date.now()}-a-${Math.random()}`, from: "assistant", text }]);

  const submitLead = async (nextLead: InboxLead, announce = true) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaveState("sending");
    savePending(nextLead);
    try {
      const result = await sendMutation.mutateAsync({
        id: nextLead.id,
        name: nextLead.name,
        phone: nextLead.phone,
        request: nextLead.request,
        source: nextLead.source,
      });
      if (!result?.success) throw new Error("لم يؤكد الخادم حفظ الطلب.");
      clearPending(nextLead.id);
      saveLead(nextLead);
      setLead(nextLead);
      setSaveState("saved");
      setStage("done");
      if (announce) addAssistant("تم حفظ بيانات طلبك في صندوق الرسائل الداخلي للمتابعة. لن تُرسل بياناتك إلى واتساب.");
    } catch {
      // The pending payload remains retryable. This local copy is explicitly not a server delivery.
      savePending(nextLead);
      saveLead(nextLead);
      setLead(nextLead);
      setSaveState("failed");
      setStage("request");
      if (announce) addAssistant("تعذر تأكيد حفظ الطلب في صندوق الموقع. لم يصل الطلب إلى المالك بعد؛ حُفظت نسخة على جهازك فقط ويمكنك إعادة المحاولة.");
    } finally {
      submittingRef.current = false;
    }
  };

  const retry = () => {
    if (!lead.id || !lead.name || !lead.phone || !lead.request) return;
    void submitLead({
      id: lead.id,
      name: lead.name,
      phone: lead.phone,
      request: lead.request,
      source: lead.source || "المحادثة التجريبية",
      status: "new",
      createdAt: lead.createdAt || new Date().toISOString(),
    }, true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || saveState === "sending") return;
    setMessages((current) => [...current, { id: `${Date.now()}-u-${Math.random()}`, from: "user", text: value }]);
    setInput("");

    if (stage === "name") {
      setLead((current) => ({ ...current, name: value.slice(0, 150) }));
      setStage("phone");
      addAssistant("شكرًا. اكتب رقم الواتساب مع رمز الدولة، مثل: +9677XXXXXXX.");
      return;
    }
    if (stage === "phone") {
      if (!/^\+?[0-9\s-]{8,20}$/.test(value)) {
        addAssistant("يرجى كتابة رقم صحيح مع رمز الدولة، مثل: +9677XXXXXXX.");
        return;
      }
      setLead((current) => ({ ...current, phone: value }));
      setStage("request");
      addAssistant("ما الخدمة أو تفاصيل الطلب التي تريد إرسالها لأبو كيان؟");
      return;
    }
    if (stage === "request") {
      if (value.length > 10000) {
        addAssistant("يرجى اختصار تفاصيل الطلب إلى 10000 حرف أو أقل.");
        return;
      }
      const nextLead: InboxLead = {
        id: crypto.randomUUID(),
        name: (lead.name || "عميل من الموقع").slice(0, 150),
        phone: lead.phone || "غير محدد",
        request: value,
        source: "المحادثة التجريبية",
        status: "new",
        createdAt: new Date().toISOString(),
      };
      setLead(nextLead);
      void submitLead(nextLead);
      return;
    }

    const wantsContact = /تواصل|اتواصل|طلب|واتساب|حجز|سعر|اسعار|أسعار|أريد|اريد/.test(value);
    if (wantsContact) {
      setStage("name");
      setSaveState("idle");
      addAssistant("يسعدني ذلك. ما اسمك؟");
      return;
    }
    addAssistant(replyFor(value));
  };

  return (
    <div className={`chat-assistant ${open ? "is-open" : ""}`} dir="rtl">
      {open && (
        <section className="chat-panel" aria-label="المحادثة التجريبية">
          <header className="chat-head"><div><span><Bot size={15} /> مساعد أبو كيان</span><strong>معاينة تجريبية</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="إغلاق المحادثة"><X size={17} /></button></header>
          <div className="chat-messages" aria-live="polite">
            {messages.map((message) => <div className={`chat-bubble ${message.from}`} key={message.id}>{message.text}</div>)}
            {saveState === "saved" && <div className="chat-done"><Check size={14} /> حُفظ الطلب في خادم الموقع</div>}
            {saveState === "failed" && <div className="chat-failure" role="alert"><span>النسخة الحالية محفوظة على جهازك فقط، ولم تُرسل للمالك.</span><button type="button" onClick={retry}><RefreshCw size={13} /> إعادة المحاولة</button></div>}
            {saveState === "sending" && <div className="chat-saving" role="status">جارٍ حفظ الطلب في صندوق الموقع…</div>}
          </div>
          <form className="chat-form" onSubmit={submit}><input id="chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={stage === "name" ? "اكتب اسمك" : stage === "phone" ? "رقم الواتساب مع رمز الدولة" : stage === "request" ? "اكتب تفاصيل طلبك" : "اكتب سؤالك هنا..."} maxLength={stage === "name" ? 150 : 10000} disabled={saveState === "sending"} /><button type="submit" aria-label="إرسال" disabled={saveState === "sending"}><Send size={16} /></button></form>
          <small className="chat-disclaimer">عند نجاح الحفظ تُخزّن بياناتك في خادم الموقع فقط، ولا تُرسل إلى واتساب.</small>
        </section>
      )}
      <button type="button" className="chat-trigger" onClick={() => setOpen((current) => !current)} aria-label={open ? "إغلاق المحادثة" : "بدء محادثة"}><MessageCircle size={19} /> <span>{open ? "إغلاق" : "ابدأ محادثة"}</span></button>
    </div>
  );
}
