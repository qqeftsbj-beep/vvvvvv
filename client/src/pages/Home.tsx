/*
  Design reminder — Editorial Desert Studio:
  Arabic RTL art-direction, deep Junaidi indigo, warm sand paper, antique gold accents,
  asymmetric editorial composition, tactile portfolio cards, direct and warm copy.
*/

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  ArrowUp,
  Check,
  Moon,
  Sun,
  ChevronDown,
  ExternalLink,
  Facebook,
  Instagram,
  LayoutTemplate,
  LockKeyhole,
  Menu,
  Megaphone,
  MessageCircle,
  Play,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { SiteContent, loadSiteContent } from "@/lib/siteContent";
import ChatAssistant from "@/components/ChatAssistant";

const whatsappChannel =
  "https://whatsapp.com/channel/0029Vb7dajy8vd1Hr860dd2N";

function BrandSeal({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      width={className === "contact-seal-mark" ? 28 : className === "signature-mark" ? 25 : 33}
      height={className === "contact-seal-mark" ? 28 : className === "signature-mark" ? 25 : 33}
      style={{ display: "block", width: className === "contact-seal-mark" ? 28 : className === "signature-mark" ? 25 : 33, height: className === "contact-seal-mark" ? 28 : className === "signature-mark" ? 25 : 33 }}
      aria-hidden="true"
    >
      <path d="M8 35V20.5C8 14.7 12.7 10 18.5 10c3.1 0 5.9 1.4 7.7 3.7C28 11.4 30.8 10 34 10c5.8 0 10 4.7 10 10.5V35h-7V21.3c0-2.1-1.4-3.7-3.2-3.7s-3.6 1.6-3.6 3.7V35h-7V21.3c0-2.1-1.4-3.7-3.2-3.7s-3.6 1.6-3.6 3.7V35H8Z" fill="currentColor" />
      <circle cx="27" cy="8" r="2.5" fill="#c6a45d" />
    </svg>
  );
}

const services = [
  {
    number: "01",
    icon: Sparkles,
    title: "تصاميم المناسبات",
    description:
      "بطاقات تهنئة للأعراس والتخرج والحفلات تُبنى حول اسمك، لونك، واللحظة التي تريد أن تبقى.",
    tag: "تصميم AI + إخراج بصري",
  },
  {
    number: "02",
    icon: Megaphone,
    title: "الإعلانات الممولة",
    description:
      "حملة فيسبوك أوضح: رسالة مفهومة، جمهور أدق، ومحتوى يفتح باب التواصل بدل أن يمر مرورًا عابرًا.",
    tag: "استراتيجية + إدارة",
  },
  {
    number: "03",
    icon: LayoutTemplate,
    title: "المواقع وصفحات الهبوط",
    description:
      "نحوّل فكرتك إلى واجهة مرتبة، سريعة، ومتجاوبة تساعد العميل على فهمك واتخاذ الخطوة التالية.",
    tag: "ويب + تجربة مستخدم",
  },
];

const portfolio = [
  {
    image: "/manus-storage/abu-kayan-ai-1_8c6ac08d.jpg",
    eyebrow: "تصميم AI",
    title: "فكرة تُخرج من الشاشة",
    text: "تصميم بصري يشرح التقنية بلغة يمكن تذكّرها.",
    tone: "sand-card",
  },
  {
    image: "/manus-storage/abu-kayan-ads-1_49b30575.jpg",
    eyebrow: "إعلان ممول",
    title: "الوصول ليس صدفة",
    text: "فكرة إعلانية تُبنى حول الجمهور والهدف.",
    tone: "indigo-card",
  },
  {
    image: "/manus-storage/abu-kayan-dev-1_f63ffd4f.jpg",
    eyebrow: "تصميم تجاري",
    title: "تفاصيل تعطي الثقة",
    text: "هوية مرئية تُجهز للنشر وتبقى في الذاكرة.",
    tone: "terracotta-card",
  },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightMode, setLightMode] = useState(() => window.localStorage.getItem("abu-kayan-theme") === "light");
  const [brandClicks, setBrandClicks] = useState(0);
  const [content, setContent] = useState<SiteContent>(() => loadSiteContent());
  const [, navigate] = useLocation();

  useEffect(() => {
    document.documentElement.dataset.siteTheme = lightMode ? "light" : "dark";
    window.localStorage.setItem("abu-kayan-theme", lightMode ? "light" : "dark");
  }, [lightMode]);

  useEffect(() => {
    const syncContent = () => setContent(loadSiteContent());
    window.addEventListener("abu-kayan-content-updated", syncContent);
    return () => window.removeEventListener("abu-kayan-content-updated", syncContent);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("motion-ready");
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (!("IntersectionObserver" in window)) {
      targets.forEach((target) => target.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  const handlePlaceholder = (label: string) => {
    toast(`${label} متاح ضمن المعاينة، وسيُربط بعد اعتماد النسخة النهائية.`);
  };

  const handleNav = (id: string) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  const handleBrandClick = () => {
    setBrandClicks((current) => {
      const next = current + 1;
      if (next >= 5) {
        navigate("/owner");
        return 0;
      }
      return next;
    });
  };

  return (
    <main dir="rtl" className={`site-shell ${lightMode ? "site-light" : ""}`}>
      <div className="paper-grain" aria-hidden="true" />
      <header className="site-header">
        <div className="header-inner">
          <button
            type="button"
            className="brand-lockup"
            onClick={handleBrandClick}
            aria-label="العودة إلى بداية الموقع"
          >
            <span className="brand-mark-wrap">
              <BrandSeal className="brand-mark" />
            </span>
            <span className="brand-avatar"><img src="/manus-storage/abu-kayan-profile_85a5e4ec.jpg" alt="" /></span>
            <span className="brand-copy">
              <strong>أبو كيان الجنيد</strong>
              <span>استوديو إبداعي · اليمن</span>
            </span>
          </button>

          <nav className={`desktop-nav ${menuOpen ? "is-open" : ""}`}>
            <button type="button" onClick={() => handleNav("services")}>
              الخدمات
            </button>
            <button type="button" onClick={() => handleNav("work")}>
              أعمال مختارة
            </button>
            <button type="button" onClick={() => handleNav("process")}>
              كيف نعمل
            </button>
            <button type="button" onClick={() => handleNav("contact")}>
              تواصل
            </button>
          </nav>

          <div className="header-actions">
            <span className="location-note">صنعاء · عدن · أونلاين</span>
            <button type="button" className="theme-toggle" onClick={() => setLightMode((current) => !current)} aria-label={lightMode ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"} title={lightMode ? "الوضع الداكن" : "الوضع الفاتح"}>{lightMode ? <Moon size={15} /> : <Sun size={15} />}</button>
            <Link href="/owner" className="header-admin"><LockKeyhole size={13} /> لوحة التحكم</Link>
            <button
              type="button"
              className="header-cta"
              onClick={() => handleNav("contact")}
            >
              ابدأ مشروعك <ArrowLeft size={15} />
            </button>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow">
            <span className="eyebrow-dot" /> {content.heroEyebrow}
          </div>
          <h1>
            {content.heroTitle}
            <em>{content.heroAccent}</em>
            {content.heroEnding}
          </h1>
          <p className="hero-lead">
            {content.heroLead}
          </p>
          <div className="hero-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => handleNav("contact")}
            >
              {content.primaryButton} <ArrowLeft size={17} />
            </button>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => handleNav("work")}
            >
              <Play size={15} fill="currentColor" /> {content.secondaryButton}
            </button>
          </div>
          <div className="ai-tool-actions" aria-label="أدوات التصميم بالذكاء الاصطناعي">
            <Link href="/templates/gemini" className="ai-tool-button"><Sparkles size={16} /> تصاميم عبر Gemini <ArrowLeft size={15} /></Link>
            <Link href="/templates/chat-gbt" className="ai-tool-button"><Sparkles size={16} /> تصاميم عبر Chat GBT <ArrowLeft size={15} /></Link>
          </div>
          <div className="hero-proof">
            <div className="proof-avatars" aria-hidden="true">
              <span>أ</span>
              <span>ك</span>
              <span>ج</span>
            </div>
            <div>
              <strong>فكرة واضحة. تصميم يليق بها.</strong>
              <span>خدمات إبداعية من أول سكتش إلى آخر نقرة.</span>
            </div>
          </div>
        </div>

        <div className="hero-art-wrap">
          <div className="hero-art-label label-top">01 / 03</div>
          <div className="hero-art-frame">
            <img
              src={content.heroImage}
              alt="شعار أبو كيان الجنيد الأصلي"
              className="hero-logo-art"
            />
            <div className="hero-art-overlay" />
            <div className="hero-art-caption">
              <span>ABU KAYAN</span>
              <span>CREATIVE STUDIO</span>
            </div>
            <div className="hero-stamp">
              <span>أبو كيان</span>
              <span>الجنيد</span>
              <small>صنع في اليمن</small>
            </div>
            <div className="hero-signature" aria-hidden="true">
              <BrandSeal className="signature-mark" />
              <span>أبو كيان</span>
              <small>اليمن · 2026</small>
            </div>
          </div>
          <div className="hero-art-label label-bottom">
            <span>إبداع / ترتيب / أثر</span>
            <ArrowUpLeft size={17} />
          </div>
        </div>
      </section>

      <div className="service-ribbon" aria-label="مجالات العمل">
        <span>تصاميم المناسبات</span>
        <i />
        <span>إعلانات فيسبوك</span>
        <i />
        <span>مواقع وصفحات هبوط</span>
        <i />
        <span>هويات وشعارات</span>
      </div>

      <section id="services" className="section services-section" data-reveal>
        <span className="section-ghost" aria-hidden="true">02</span>
        <div className="section-intro">
          <span className="section-index">/ 02</span>
          <div>
            <div className="eyebrow">خدمات مصممة حول هدفك</div>
            <h2>من اللمعة الأولى،<br />إلى الأثر الأخير.</h2>
          </div>
          <p>
            لا نضع فكرتك داخل قالب جاهز. نبدأ من المناسبة أو التحدي، ثم نختار
            الشكل والرسالة والطريق الأنسب للوصول.
          </p>
        </div>

        <div className="services-list">
          {content.services.map((service, index) => {
            const Icon = [Sparkles, Megaphone, LayoutTemplate][index % 3];
            return (
              <button
                type="button"
                className="service-row"
                data-reveal
                key={service.number}
                onClick={() => handlePlaceholder(`خدمة ${service.title}`)}
              >
                <span className="service-number">{service.number}</span>
                <span className="service-icon"><Icon size={21} strokeWidth={1.5} /></span>
                <span className="service-main">
                  <strong>{service.title}</strong>
                  <span>{service.description}</span>
                </span>
                <span className="service-tag">{service.tag}</span>
                <span className="service-arrow"><ArrowLeft size={20} /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section id="work" className="section work-section" data-reveal>
        <span className="section-ghost" aria-hidden="true">03</span>
        <div className="work-heading">
          <div>
            <div className="eyebrow">من معرض أبو كيان</div>
            <h2>أعمال لها <em>مزاجها.</em></h2>
          </div>
          <div className="work-heading-side">
            <span>03 — مختارات بصرية</span>
            <button type="button" onClick={() => handlePlaceholder("المعرض الكامل")}>
              تصفح الكل <ExternalLink size={15} />
            </button>
          </div>
        </div>

        <div className="portfolio-grid">
          {portfolio.map((item, index) => (
            <button
              type="button"
              className={`portfolio-card ${item.tone} ${index === 1 ? "portfolio-featured" : ""}`}
              data-reveal
              key={item.title}
              onClick={() => handlePlaceholder(item.title)}
            >
              <div className="portfolio-image-wrap">
                <img src={item.image} alt={item.title} className="portfolio-image" />
                <span className="portfolio-hover">شاهد التفاصيل <ArrowLeft size={15} /></span>
              </div>
              <div className="portfolio-meta">
                <span>{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section id="process" className="section process-section" data-reveal>
        <span className="section-ghost" aria-hidden="true">04</span>
        <div className="process-head">
          <span className="section-index">/ 04</span>
          <div>
            <div className="eyebrow">طريقة العمل</div>
            <h2>ثلاث خطوات.<br /><em>ولا خطوة ضائعة.</em></h2>
          </div>
          <p>
            لأن وقتك مهم، نخلي الطريق مرئيًا من البداية: كلام واضح، مراجعة سهلة،
            وتسليم تعرف ماذا سيضيف لمشروعك.
          </p>
        </div>
        <div className="process-steps">
          <div className="process-step" data-reveal>
            <span className="step-number">01</span>
            <div>
              <strong>نسمع الفكرة</strong>
              <p>نحدد المناسبة، الهدف، والجمهور الذي تريد أن يصل إليه العمل.</p>
            </div>
            <Check size={18} />
          </div>
          <div className="process-step" data-reveal>
            <span className="step-number">02</span>
            <div>
              <strong>نرتب المشهد</strong>
              <p>نحوّل الكلام إلى اتجاه بصري ورسالة يمكن مراجعتها بسهولة.</p>
            </div>
            <Check size={18} />
          </div>
          <div className="process-step" data-reveal>
            <span className="step-number">03</span>
            <div>
              <strong>نسلم الأثر</strong>
              <p>ملف جاهز للنشر أو صفحة جاهزة للتحويل، بالشكل الذي يناسبك.</p>
            </div>
            <Check size={18} />
          </div>
        </div>
      </section>

      <section className="about-strip" aria-label="عن الاستوديو" data-reveal>
        <div className="about-image-wrap">
          <img src="/manus-storage/abu-kayan-profile_85a5e4ec.jpg" alt="هوية أبو كيان الجنيد البصرية" className="about-image" />
          <span>رائد الجنيد / 2026</span>
        </div>
        <div className="about-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> خلف كل تفصيل، عين تعرف ما تريد</div>
          <h2>نصمم للناس<br /><em>وليس للخوارزمية فقط.</em></h2>
          <p>أبو كيان الجنيد مساحة إبداعية تجمع بين الحس البصري، أدوات الذكاء الاصطناعي، وفهم الإعلان حتى يصبح حضورك أوضح.</p>
        </div>
        <div className="about-note">
          <span>من اليمن</span>
          <strong>إلى كل شاشة</strong>
          <small>تصميم · فكرة · تنفيذ</small>
        </div>
      </section>

      <section id="contact" className="contact-section" data-reveal>
        <div className="contact-pattern" aria-hidden="true" />
        <div className="contact-seal" aria-hidden="true">
          <BrandSeal className="contact-seal-mark" />
          <span>أبو كيان</span>
          <small>صنع في اليمن</small>
        </div>
        <div className="contact-inner">
          <div className="contact-copy">
            <div className="eyebrow eyebrow-light"><span className="eyebrow-dot" /> خطوة واحدة تكفي</div>
            <h2>خلّ مناسبتك<br /><em>تُرى.</em></h2>
            <p>أرسل لنا نوع الخدمة وفكرتك في رسالة، ونرتب معك الباقي.</p>
          </div>
          <div className="contact-actions">
            <a className="contact-button" href={whatsappChannel} target="_blank" rel="noreferrer">
              <MessageCircle size={19} /> تواصل عبر واتساب <ArrowLeft size={17} />
            </a>
            <div className="social-row">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="فيسبوك"><Facebook size={17} /></a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="انستقرام"><Instagram size={17} /></a>
              <button type="button" onClick={() => handlePlaceholder("قناة تيك توك")}>تيك توك</button>
              <span>أو تابع جديدنا من القناة</span>
            </div>
          </div>
        </div>
        <div className="contact-footer">
          <span>© 2026 أبو كيان الجنيد</span>
          <span>تصاميم · إعلانات · ويب</span>
          <span>اليمن / أونلاين</span>
        </div>
      </section>

      <div className="side-note" aria-hidden="true">أبو كيان / اليمن</div>
      <button className="scroll-cue" type="button" onClick={() => handleNav("services")} aria-label="انتقل إلى الخدمات"><ChevronDown size={17} /></button>
      <button className="back-to-top" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="العودة إلى الأعلى"><ArrowUp size={15} /></button>
      <ChatAssistant />
    </main>
  );
}
