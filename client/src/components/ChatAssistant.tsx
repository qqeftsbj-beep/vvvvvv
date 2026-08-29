/*
  Design reminder — Luxury concierge chat:
  Fixed but calm, warm gold trigger, clear Arabic RTL messages, and no external transmission in demo mode.
*/

import { FormEvent, useEffect, useState } from "react";
import { Bot, Check, MessageCircle, Send, X } from "lucide-react";
import { toast } from "sonner";

export type InboxLead = {
  id: string;
  name: string;
  phone: string;
  request: string;
  source: string;
  createdAt: string;
};

type ChatMessage = { id: string; from: "assistant" | "user"; text: string };
type Stage = "idle" | "name" | "phone" | "request" | "done";

const INBOX_KEY = "abu-kayan-inbox";

function replyFor(text: string) {
  const normalized = text.toLowerCase();
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

function saveLead(lead: InboxLead) {
  const current = JSON.parse(window.localStorage.getItem(INBOX_KEY) || "[]") as InboxLead[];
  window.localStorage.setItem(INBOX_KEY, JSON.stringify([lead, ...current]));
  window.dispatchEvent(new Event("abu-kayan-inbox-updated"));
}

export default function ChatAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [lead, setLead] = useState<Partial<InboxLead>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", from: "assistant", text: "أهلًا بك. أنا مساعد أبو كيان التجريبي. اسألني عن خدمات التصاميم أو الإعلانات أو المواقع، وإذا رغبت بالتواصل سأجمع بيانات طلبك." },
  ]);

  useEffect(() => {
    if (open) window.setTimeout(() => document.getElementById("chat-input")?.focus(), 80);
  }, [open]);

  const addAssistant = (text: string) => setMessages((current) => [...current, { id: `${Date.now()}-a`, from: "assistant", text }]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value) return;
    setMessages((current) => [...current, { id: `${Date.now()}-u`, from: "user", text: value }]);
    setInput("");

    if (stage === "name") {
      setLead((current) => ({ ...current, name: value }));
      setStage("phone");
      addAssistant("شكرًا. اكتب رقم الواتساب مع رمز الدولة، مثل: +967775358148.");
      return;
    }
    if (stage === "phone") {
      if (!/^\+?[0-9\s-]{8,20}$/.test(value)) {
        addAssistant("يرجى كتابة رقم صحيح مع رمز الدولة، مثل: +967775358148.");
        return;
      }
      setLead((current) => ({ ...current, phone: value }));
      setStage("request");
      addAssistant("ما الخدمة أو تفاصيل الطلب التي تريد إرسالها لأبو كيان؟");
      return;
    }
    if (stage === "request") {
      const nextLead: InboxLead = {
        id: `${Date.now()}`,
        name: lead.name || "عميل من الموقع",
        phone: lead.phone || "غير محدد",
        request: value,
        source: "المحادثة التجريبية",
        createdAt: new Date().toISOString(),
      };
      saveLead(nextLead);
      setLead(nextLead);
      setStage("done");
      addAssistant("تم حفظ بيانات طلبك في صندوق الرسائل الداخلي للمتابعة. هذه معاينة تجريبية ولا ترسل البيانات إلى واتساب بعد.");
      return;
    }

    const wantsContact = /تواصل|اتواصل|طلب|واتساب|حجز|سعر|اسعار|أسعار|أريد|اريد/.test(value);
    if (wantsContact) {
      setStage("name");
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
            {stage === "done" && <div className="chat-done"><Check size={14} /> حُفظ الطلب داخليًا</div>}
          </div>
          <form className="chat-form" onSubmit={submit}><input id="chat-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={stage === "name" ? "اكتب اسمك" : stage === "phone" ? "رقم الواتساب مع رمز الدولة" : stage === "request" ? "اكتب تفاصيل طلبك" : "اكتب سؤالك هنا..."} maxLength={10000} /><button type="submit" aria-label="إرسال"><Send size={16} /></button></form>
          <small className="chat-disclaimer">المحادثة تجريبية، ولا يتم إرسال بياناتك خارجيًا.</small>
        </section>
      )}
      <button type="button" className="chat-trigger" onClick={() => setOpen((current) => !current)} aria-label={open ? "إغلاق المحادثة" : "بدء محادثة"}><MessageCircle size={19} /> <span>{open ? "إغلاق" : "ابدأ محادثة"}</span></button>
    </div>
  );
}
