import { DragEvent, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type ToolName = "Gemini" | "Chat GBT";

const ownerPin = () => (typeof window === "undefined" ? "770562" : window.localStorage.getItem("abu-kayan-owner-pin") || "770562");

export function reorderTemplateCategoryIds(ids: number[], from: number, to: number) {
  const next = [...ids];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function slugify(value: string, tool: ToolName) {
  const cleaned = value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06ff-]+/g, "").replace(/^-+|-+$/g, "");
  return `${tool === "Gemini" ? "gemini" : "chat"}-${cleaned || Date.now()}`.slice(0, 155);
}

export default function OwnerTemplateCategories({ tool }: { tool: ToolName }) {
  const query = trpc.templateCategories.adminList.useQuery({ tool }, { staleTime: 0 });
  const utils = trpc.useUtils();
  const [dragged, setDragged] = useState<number | null>(null);
  const refresh = () => {
    void utils.templateCategories.adminList.invalidate({ tool });
    void utils.templateCategories.list.invalidate({ tool });
    void utils.templates.list.invalidate({ tool });
  };
  const create = trpc.templateCategories.createWithPin.useMutation({ onSuccess: () => { refresh(); toast.success("تمت إضافة قسم التصاميم ومزامنته."); } });
  const update = trpc.templateCategories.updateWithPin.useMutation({ onSuccess: () => { refresh(); toast.success("تم حفظ قسم التصاميم."); } });
  const reorder = trpc.templateCategories.reorderWithPin.useMutation({ onSuccess: () => { refresh(); toast.success("تم حفظ ترتيب الأقسام لجميع الزوار."); } });
  const remove = trpc.templateCategories.removeWithPin.useMutation({ onSuccess: () => { refresh(); toast.success("تم حذف القسم ونقل قوالبه إلى قسم أخرى."); } });

  const categories = query.data || [];
  const moveBy = (index: number, direction: -1 | 1) => {
    const ids = reorderTemplateCategoryIds(categories.map((item) => item.id), index, index + direction);
    if (ids !== categories.map((item) => item.id)) reorder.mutate({ ownerPin: ownerPin(), tool, ids });
  };
  const drop = (event: DragEvent<HTMLDivElement>, target: number) => {
    event.preventDefault();
    if (dragged === null) return;
    const ids = reorderTemplateCategoryIds(categories.map((item) => item.id), dragged, target);
    setDragged(null);
    reorder.mutate({ ownerPin: ownerPin(), tool, ids });
  };

  return <section className="owner-services-card owner-template-categories-card">
    <div className="owner-card-heading">
      <div><span className="studio-label">{tool === "Gemini" ? "09 / Gemini وChatGPT" : "10 / تصاميم الأطفال"}</span><h2>{tool === "Gemini" ? "أقسام تصاميم Gemini وChatGPT" : "أقسام تصاميم الأطفال"}</h2></div>
      <button type="button" className="owner-add" onClick={() => { const name = "قسم جديد"; create.mutate({ ownerPin: ownerPin(), tool, name, slug: slugify(name, tool), sortOrder: categories.length + 1, isVisible: true }); }}><Plus size={16} /> إضافة قسم</button>
    </div>
    <p className="owner-security-note">هذه الأقسام مستقلة عن الزر الآخر. اسحب القسم أو استخدم الأسهم، وسيظهر الترتيب نفسه للزوار على الهاتف والكمبيوتر.</p>
    <div className="owner-category-list">
      {categories.map((category, index) => <div className="owner-category-row owner-template-category-row" key={category.id} draggable onDragStart={() => setDragged(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, index)}>
        <span className="owner-category-drag" aria-label="اسحب لترتيب القسم"><GripVertical size={18} /></span>
        <label><span>اسم القسم</span><input defaultValue={category.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== category.name) update.mutate({ ownerPin: ownerPin(), id: category.id, name }); }} /></label>
        <label><span>الرابط الداخلي</span><input defaultValue={category.slug} onBlur={(event) => { const slug = event.target.value.trim(); if (slug && slug !== category.slug) update.mutate({ ownerPin: ownerPin(), id: category.id, slug }); }} /></label>
        <label><span>الظهور</span><select defaultValue={category.isVisible === 1 ? "visible" : "hidden"} onChange={(event) => update.mutate({ ownerPin: ownerPin(), id: category.id, isVisible: event.target.value === "visible" })}><option value="visible">ظاهر</option><option value="hidden">مخفي</option></select></label>
        <div className="owner-category-move"><button type="button" onClick={() => moveBy(index, -1)} disabled={index === 0} aria-label="تحريك القسم للأعلى"><ChevronUp size={15} /></button><button type="button" onClick={() => moveBy(index, 1)} disabled={index === categories.length - 1} aria-label="تحريك القسم للأسفل"><ChevronDown size={15} /></button></div>
        <button type="button" className="owner-delete" onClick={() => { if (window.confirm("حذف هذا القسم؟ ستبقى القوالب محفوظة وسيتم نقلها إلى «أخرى».")) remove.mutate({ ownerPin: ownerPin(), id: category.id }); }} aria-label={`حذف قسم ${category.name}`}><Trash2 size={16} /></button><Save size={15} className="owner-category-save-mark" />
      </div>)}
    </div>
  </section>;
}
