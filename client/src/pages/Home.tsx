/*
  Design reminder — Editorial Desert Studio:
  Arabic RTL art-direction, deep Junaidi indigo, warm sand paper, antique gold accents,
  asymmetric editorial composition, tactile portfolio cards, direct and warm copy.
*/

import { CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  ArrowUp,
  Check,
  Globe2,
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
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";
import { EditableButton, SiteContent, loadSiteContent } from "@/lib/siteContent";
import { useTheme } from "@/contexts/ThemeContext";
import ChatAssistant from "@/components/ChatAssistant";
import { trpc } from "@/lib/trpc";

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
  const { theme, toggleTheme } = useTheme();
  const lightMode = theme === "light";
  const [brandClicks, setBrandClicks] = useState(0);
  const [content, setContent] = useState<SiteContent>(() => loadSiteContent());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [, navigate] = useLocation();
  const geminiTemplates = trpc.templates.list.useQuery({ tool: "Gemini" }, { staleTime: 30_000 });
  const chatTemplates = trpc.templates.list.useQuery({ tool: "Chat GBT" }, { staleTime: 30_000 });

  useEffect(() => {
    const syncContent = () => setContent(loadSiteContent());
    window.addEventListener("abu-kayan-content-updated", syncContent);
    return () => window.removeEventListener("abu-kayan-content-updated", syncContent);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

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

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase("ar");
    if (!term) return [] as Array<{ id: string; title: string; detail: string; kind: string; action: () => void }>;
    const results: Array<{ id: string; title: string; detail: string; kind: string; action: () => void }> = [];
    content.services.forEach((service) => {
      if (`${service.title} ${service.description} ${service.tag}`.toLocaleLowerCase("ar").includes(term)) results.push({ id: `service-${service.number}`, title: service.title, detail: service.description, kind: "خدمة", action: () => { setSearchOpen(false); handleNav("services"); } });
    });
    content.products.forEach((product) => {
      if (`${product.title} ${product.description} ${product.price}`.toLocaleLowerCase("ar").includes(term)) results.push({ id: `product-${product.id}`, title: product.title, detail: `${product.description} ${product.price}`.trim(), kind: "منتج", action: () => { setSearchOpen(false); handleNav("products"); } });
    });
    portfolio.forEach((item) => {
      if (`${item.title} ${item.text} ${item.eyebrow}`.toLocaleLowerCase("ar").includes(term)) results.push({ id: `work-${item.title}`, title: item.title, detail: item.text, kind: "عمل", action: () => { setSearchOpen(false); handleNav("work"); } });
    });
    [...(geminiTemplates.data || []), ...(chatTemplates.data || [])].forEach((template) => {
      if (`${template.text} ${template.imageName} ${template.tool}`.toLocaleLowerCase("ar").includes(term)) results.push({ id: `template-${template.id}`, title: template.imageName || "قالب تصميم", detail: template.text, kind: template.tool, action: () => { setSearchOpen(false); navigate(template.tool === "Gemini" ? "/templates/gemini" : "/templates/chat-gbt"); } });
    });
    return results.slice(0, 12);
  }, [chatTemplates.data, content, geminiTemplates.data, navigate, searchTerm]);

  const handleCustomButton = (button: EditableButton) => {
    if (button.action === "external" && button.url) {
      window.open(button.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (button.action === "gemini") return navigate("/templates/gemini");
    if (button.action === "chat-gbt") return navigate("/templates/chat-gbt");
    if (button.action === "services") return handleNav("services");
    if (button.action === "work") return handleNav("work");
    handleNav("contact");
  };

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

  const dynamicStyle = {
    "--dynamic-font": content.settings.fontFamily === "system" ? "system-ui, sans-serif" : `"${content.settings.fontFamily}", Tahoma, sans-serif`,
    "--dynamic-heading-font": content.settings.headingFontFamily === "system" ? "system-ui, sans-serif" : `"${content.settings.headingFontFamily}", Tahoma, sans-serif`,
    "--dynamic-base": `${content.settings.baseFontSize}px`,
    "--dynamic-heading": content.settings.headingScale,
    "--dynamic-weight": content.settings.fontWeight,
    "--dynamic-line-height": content.settings.lineHeight,
    "--dynamic-section-gap": `${content.settings.sectionGap}px`,
    "--dynamic-button-radius": `${content.settings.buttonRadius}px`,
    "--dynamic-card-radius": `${content.settings.cardRadius}px`,
    "--dynamic-bg": lightMode ? "#f6f1e8" : content.settings.backgroundColor,
    "--dynamic-panel": lightMode ? "#fffdf8" : content.settings.panelColor,
    "--dynamic-text": lightMode ? "#17243a" : content.settings.textColor,
    "--dynamic-muted": lightMode ? "#596476" : content.settings.mutedColor,
    "--dynamic-border": lightMode ? "#c8bba8" : content.settings.borderColor,
    "--dynamic-accent": content.settings.accentColor,
    "--dynamic-gold": content.settings.goldColor,
    ...(content.settings.backgroundImage ? { backgroundImage: `linear-gradient(${lightMode ? "rgba(246,241,232,.84), rgba(246,241,232,.92)" : "rgba(8,11,17,.84), rgba(8,11,17,.92)"}), url(${content.settings.backgroundImage})` } : {}),
  } as CSSProperties;
  const customButtons = (placement: EditableButton["placement"]) => content.buttons.filter((button) => button.placement === placement).sort((a, b) => (a.order || 0) - (b.order || 0));
  const customButtonStyle = (button: EditableButton) => ({ backgroundColor: button.backgroundColor || undefined, color: button.textColor || undefined, borderColor: button.borderColor || undefined, borderRadius: `${button.radius ?? content.settings.buttonRadius}px`, fontSize: button.fontSize ? `${button.fontSize}px` : undefined });
  return (
    <main dir="rtl" className={`site-shell ${lightMode ? "site-light" : ""}`} style={dynamicStyle}>
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
            <button type="button" className="theme-toggle" onClick={() => setSearchOpen((open) => !open)} aria-label="البحث في الموقع" title="بحث"><Search size={15} /></button>
            <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={lightMode ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"} title={lightMode ? "الوضع الداكن" : "الوضع الفاتح"}>{lightMode ? <Moon size={15} /> : <Sun size={15} />}</button>
            {customButtons("header").map((button) => <button key={button.id} type="button" className="header-admin custom-site-button" style={customButtonStyle(button)} onClick={() => handleCustomButton(button)}>{button.label}</button>)}
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

      <div className={`mobile-drawer-backdrop ${menuOpen ? "is-open" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <aside className={`mobile-service-drawer ${menuOpen ? "is-open" : ""}`} aria-label="قائمة الخدمات الجانبية" aria-hidden={!menuOpen}>
        <div className="mobile-drawer-head"><div><span className="studio-label">دليل الموقع</span><strong>الخدمات والتنقل</strong></div><button type="button" onClick={() => setMenuOpen(false)} aria-label="إغلاق القائمة"><X size={20} /></button></div>
        <div className="mobile-drawer-links">
          <button type="button" onClick={() => handleNav("services")}><span>01</span><strong>الخدمات</strong><ArrowLeft size={15} /></button>
          {content.services.map((service, index) => <button type="button" key={`${service.number}-${index}`} onClick={() => { setMenuOpen(false); handlePlaceholder(`خدمة ${service.title}`); }}><span>{service.number}</span><strong>{service.title}</strong><ArrowLeft size={15} /></button>)}
          <button type="button" onClick={() => handleNav("work")}><span>02</span><strong>أعمال مختارة</strong><ArrowLeft size={15} /></button>
          <button type="button" onClick={() => handleNav("process")}><span>03</span><strong>كيف نعمل</strong><ArrowLeft size={15} /></button>
          <button type="button" onClick={() => handleNav("contact")}><span>04</span><strong>تواصل</strong><ArrowLeft size={15} /></button>
        </div>
        <div className="mobile-drawer-foot"><Globe2 size={15} /> صنع في اليمن · أونلاين</div>
      </aside>

      {searchOpen && <section className="site-search" role="search" aria-label="البحث في الموقع">
        <div className="site-search-inner">
          <div className="site-search-heading"><span className="eyebrow"><Search size={14} /> بحث عام</span><button type="button" onClick={() => { setSearchOpen(false); setSearchTerm(""); }} aria-label="إغلاق البحث">×</button></div>
          <input autoFocus value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="ابحث عن خدمة أو نص أو صورة أو قالب..." aria-label="ابحث في الموقع" />
          {searchTerm.trim() && <div className="site-search-results">{searchResults.length ? searchResults.map((result) => <button type="button" key={result.id} onClick={result.action}><span><small>{result.kind}</small><strong>{result.title}</strong></span><em>{result.detail}</em><ArrowLeft size={15} /></button>) : <p>لا توجد نتائج مطابقة حتى الآن.</p>}</div>}
        </div>
      </section>}

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

          <div className="ai-tool-actions" aria-label="أدوات التصميم بالذكاء الاصطناعي">
            <Link href="/templates/gemini" className="ai-tool-button"><Sparkles size={16} /> تصاميم عبر Gemini <ArrowLeft size={15} /></Link>
            <Link href="/templates/chat-gbt" className="ai-tool-button"><Sparkles size={16} /> تصاميم عبر Chat GBT <ArrowLeft size={15} /></Link>
            <Link href="/free-sites" className="ai-tool-button"><Globe2 size={16} /> مواقع وخدمات مجانية مختارة <ArrowLeft size={15} /></Link>
            <Link href="/creative-space" className="ai-tool-button"><Sparkles size={16} /> مساحتك للإبداع <ArrowLeft size={15} /></Link>
          </div>
          {customButtons("hero").length > 0 && <div className="custom-hero-actions">{customButtons("hero").map((button) => <button key={button.id} type="button" className="custom-site-button" style={customButtonStyle(button)} onClick={() => handleCustomButton(button)}>{button.label}<ArrowLeft size={14} /></button>)}</div>}
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

        <div className="services-list service-cards-grid">
          {content.services.map((service, index) => {
            const Icon = [Sparkles, Megaphone, LayoutTemplate][index % 3];
            const serviceImage = service.image || portfolio[index % portfolio.length]?.image;
            return (
              <button
                type="button"
                className="service-card"
                data-reveal
                key={service.number}
                onClick={() => handlePlaceholder(`خدمة ${service.title}`)}
              >
                <span className="service-card-media">
                  {serviceImage ? <img src={serviceImage} alt={`صورة ${service.title}`} loading="lazy" /> : <Icon size={34} strokeWidth={1.4} />}
                  <span className="service-card-number">{service.number}</span>
                </span>
                <span className="service-card-body">
                  <span className="service-card-heading">
                    <span className="service-icon"><Icon size={18} strokeWidth={1.6} /></span>
                    <strong>{service.title}</strong>
                  </span>
                  <span className="service-main">
                    <span>{service.description}</span>
                  </span>
                  <span className="service-card-footer">
                    <span className="service-tag">{service.tag}</span>
                    <span className="service-arrow"><ArrowLeft size={18} /></span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {customButtons("services").length > 0 && <div className="custom-section-actions">{customButtons("services").map((button) => <button key={button.id} type="button" className="custom-site-button" style={customButtonStyle(button)} onClick={() => handleCustomButton(button)}>{button.label}<ArrowLeft size={14} /></button>)}</div>}
      </section>

      {content.products.length > 0 && <section id="products" className="section products-section" data-reveal><span className="section-ghost" aria-hidden="true">04</span><div className="section-intro"><span className="section-index">/ 04</span><div><div className="eyebrow">منتجات وخدمات جاهزة</div><h2>أشياء صُممت<br /><em>لتُطلب الآن.</em></h2></div><p>أضف منتجاتك أو باقاتك من لوحة التحكم، واجعلها ظاهرة في واجهة الموقع بشكل واضح.</p></div><div className="product-grid">{content.products.map((product) => <article className="product-card" key={product.id}>{product.image && <img src={product.image} alt="" loading="lazy" />}<div><h3>{product.title}</h3><p>{product.description}</p><strong>{product.price}</strong></div></article>)}</div></section>}

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
            {customButtons("contact").map((button) => <button key={button.id} type="button" className="contact-button custom-site-button" style={customButtonStyle(button)} onClick={() => handleCustomButton(button)}>{button.label}<ArrowLeft size={14} /></button>)}
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
