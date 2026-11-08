import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  Trash2,
  Eye,
} from "lucide-react";
import type {
  EditableButton,
  EditablePage,
  SiteSettings,
} from "@/lib/siteContent";
import { buttonDestination, existingDestinations } from "@/lib/buttonRouting";
import { toast } from "sonner";

type Props = {
  buttons: EditableButton[];
  pages: EditablePage[];
  settings: SiteSettings;
  onChange: (buttons: EditableButton[]) => void;
};
const actions: Record<EditableButton["action"], string> = {
  contact: "قسم التواصل",
  services: "قسم الخدمات",
  work: "الأعمال الحالية",
  gemini: "تصاميم عبر Gemini وChatGPT",
  "chat-gbt": "تصاميم الأطفال",
  "free-sites": "المواقع المجانية",
  "creative-space": "مساحتك الإبداعية",
  "custom-page": "صفحة من إدارة الصفحات",
  internal: "صفحة داخلية أخرى",
  external: "رابط خارجي",
};
export default function OwnerButtons({
  buttons,
  pages,
  settings,
  onChange,
}: Props) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const update = (index: number, values: Partial<EditableButton>) =>
    onChange(
      buttons.map((item, i) => (i === index ? { ...item, ...values } : item))
    );
  const move = (from: number, to: number) => {
    if (to < 0 || to >= buttons.length || from === to) return;
    const next = [...buttons];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next.map((button, i) => ({ ...button, order: i + 1 })));
  };
  const add = () => {
    const id = crypto.randomUUID();
    onChange([
      ...buttons,
      {
        id,
        label: "زر جديد",
        action: "contact",
        placement: "hero",
        visible: true,
        icon: "sparkles",
        order: buttons.length + 1,
      },
    ]);
    setOpened(id);
  };
  const test = (button: EditableButton) => {
    const destination = buttonDestination(button);
    if (!destination)
      return toast.error(
        "اختر وجهة داخلية أو رابط HTTPS صالحًا."
      );
    window.open(
      destination.url.startsWith("#") ? `/${destination.url}` : destination.url,
      "_blank",
      "noopener,noreferrer"
    );
  };
  return (
    <section className="owner-services-card owner-buttons-manager">
      <div className="owner-card-heading">
        <div>
          <span className="studio-label">الأزرار الحالية</span>
          <h2>إدارة الأزرار وربط الوجهات</h2>
        </div>
        <button type="button" className="owner-add" onClick={add}>
          <Plus size={16} /> إضافة زر
        </button>
      </div>
      <p className="owner-security-note">
        اسحب المقبض لترتيب الأزرار، أو استخدم الأسهم على الهاتف. افتح الزر
        لتعديل تفاصيله. تُزامن التغييرات بعد حفظ التعديلات أعلى اللوحة.
      </p>
      <div className="owner-managed-list">
        {!buttons.length && (
          <p className="owner-empty">
            لا توجد أزرار. يمكنك إنشاء زر جديد دون تعديل البرمجة.
          </p>
        )}
        {buttons.map((button, index) => (
          <details
            key={button.id}
            className="owner-managed-item"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.stopPropagation();
              if (dragged !== null) move(dragged, index);
              setDragged(null);
            }}
            open={opened === button.id}
            onToggle={event => {
              if (event.currentTarget.open) setOpened(button.id);
              else setOpened(value => (value === button.id ? null : value));
            }}
          >
            <summary
              className="owner-managed-summary"
              onClick={event => {
                event.preventDefault();
                setOpened(opened === button.id ? null : button.id);
              }}
            >
              <span
                className="owner-button-drag"
                draggable
                onDragStart={event => {
                  event.stopPropagation();
                  setDragged(index);
                }}
                aria-label="مقبض ترتيب الزر"
              >
                <GripVertical size={18} />
              </span>
              <span>
                <strong>{button.label || "زر بلا اسم"}</strong>
                <small>
                  {index + 1} · {button.visible === false ? "مخفي" : "ظاهر"} ·{" "}
                  {actions[button.action]}
                </small>
              </span>
              <span className="owner-summary-chevron">
                {opened === button.id ? "−" : "+"}
              </span>
            </summary>
            <div
              onDragOver={event => event.preventDefault()}
              onDrop={() => {
                if (dragged !== null) move(dragged, index);
                setDragged(null);
              }}
              className="owner-managed-body"
            >
              <div className="owner-item-toolbar">
                <button
                  type="button"
                  className="owner-add"
                  aria-label={`تقديم ${button.label}`}
                  disabled={!index}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={16} /> تقديم
                </button>
                <button
                  type="button"
                  className="owner-add"
                  aria-label={`تأخير ${button.label}`}
                  disabled={index === buttons.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={16} /> تأخير
                </button>
                <button
                  type="button"
                  className="owner-add"
                  onClick={() => test(button)}
                >
                  <Eye size={16} /> اختبار الوجهة
                </button>
                <button
                  type="button"
                  className="owner-delete"
                  onClick={() => {
                    if (
                      window.confirm(
                        `حذف الزر «${button.label}»؟ لن يتم حذف الصفحة المرتبطة به.`
                      )
                    )
                      onChange(buttons.filter((_, i) => i !== index));
                  }}
                >
                  <Trash2 size={16} /> حذف الزر
                </button>
              </div>
              <div className="owner-fields settings-fields">
                <label>
                  <span>اسم الزر</span>
                  <input
                    value={button.label}
                    onChange={event =>
                      update(index, { label: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>مكان الظهور</span>
                  <select
                    value={button.placement}
                    onChange={event =>
                      update(index, {
                        placement: event.target
                          .value as EditableButton["placement"],
                      })
                    }
                  >
                    <option value="hero">واجهة البداية</option>
                    <option value="header">رأس الصفحة</option>
                    <option value="services">قسم الخدمات</option>
                    <option value="contact">قسم التواصل</option>
                  </select>
                </label>
                <label>
                  <span>وجهة الزر</span>
                  <select
                    value={button.action}
                    onChange={event =>
                      update(index, {
                        action: event.target.value as EditableButton["action"],
                      })
                    }
                  >
                    {Object.entries(actions).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {button.action === "custom-page" && (
                  <label>
                    <span>اختر الصفحة أو صفحة الهبوط</span>
                    <select
                      value={button.url || ""}
                      onChange={event =>
                        update(index, { url: event.target.value })
                      }
                    >
                      <option value="">اختر صفحة</option>
                      {pages.map(page => (
                        <option key={page.id} value={`/custom/${page.slug}`}>
                          {page.title}{" "}
                          {page.visible && page.status !== "draft"
                            ? ""
                            : "(غير منشورة)"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {button.action === "internal" && (
                  <label>
                    <span>رابط الصفحة الداخلية</span>
                    <input
                      value={button.url || ""}
                      list={`internal-${button.id}`}
                      placeholder="/creative-space"
                      onChange={event =>
                        update(index, { url: event.target.value })
                      }
                    />
                    <datalist id={`internal-${button.id}`}>
                      {existingDestinations.map(item => (
                        <option key={item.url} value={item.url}>
                          {item.label}
                        </option>
                      ))}
                    </datalist>
                  </label>
                )}
                {button.action === "external" && (
                  <label>
                    <span>الرابط الخارجي</span>
                    <input
                      type="url"
                      value={button.url || ""}
                      placeholder="https://"
                      aria-invalid={Boolean(button.url && !buttonDestination(button))}
                      onChange={event =>
                        update(index, { url: event.target.value })
                      }
                    />
                    {!button.url || !buttonDestination(button) ? <small className="owner-button-url-error">أدخل رابطًا يبدأ بـ https:// حتى يعمل الزر بأمان.</small> : null}
                  </label>
                )}
                <label>
                  <span>طريقة فتح الوجهة</span>
                  <select
                    value={
                      button.target ||
                      (button.action === "external" ? "_blank" : "_self")
                    }
                    onChange={event =>
                      update(index, {
                        target: event.target.value as "_self" | "_blank",
                      })
                    }
                  >
                    <option value="_self">نفس النافذة</option>
                    <option value="_blank">نافذة جديدة</option>
                  </select>
                </label>
                <label>
                  <span>الظهور</span>
                  <select
                    value={button.visible === false ? "hidden" : "visible"}
                    onChange={event =>
                      update(index, {
                        visible: event.target.value === "visible",
                      })
                    }
                  >
                    <option value="visible">إظهار</option>
                    <option value="hidden">إخفاء دون فراغ</option>
                  </select>
                </label>
                <label>
                  <span>الأيقونة</span>
                  <select
                    value={button.icon || "sparkles"}
                    onChange={event =>
                      update(index, {
                        icon: event.target.value as EditableButton["icon"],
                      })
                    }
                  >
                    <option value="sparkles">لمعة</option>
                    <option value="globe">مواقع</option>
                    <option value="message">رسالة</option>
                    <option value="arrow">سهم</option>
                  </select>
                </label>
                <label>
                  <span>حجم الزر</span>
                  <select
                    value={button.size || "medium"}
                    onChange={event =>
                      update(index, {
                        size: event.target.value as EditableButton["size"],
                      })
                    }
                  >
                    <option value="small">صغير</option>
                    <option value="medium">متوسط</option>
                    <option value="large">كبير</option>
                  </select>
                </label>
                <label>
                  <span>حجم النص</span>
                  <input
                    type="number"
                    min={9}
                    max={24}
                    value={button.fontSize ?? 12}
                    onChange={event =>
                      update(index, { fontSize: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>استدارة الحواف</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={button.radius ?? settings.buttonRadius}
                    onChange={event =>
                      update(index, { radius: Number(event.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>لون الخلفية</span>
                  <input
                    type="color"
                    value={button.backgroundColor || settings.goldColor}
                    onChange={event =>
                      update(index, { backgroundColor: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>لون النص</span>
                  <input
                    type="color"
                    value={button.textColor || settings.backgroundColor}
                    onChange={event =>
                      update(index, { textColor: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>لون الإطار</span>
                  <input
                    type="color"
                    value={button.borderColor || settings.goldColor}
                    onChange={event =>
                      update(index, { borderColor: event.target.value })
                    }
                  />
                </label>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
