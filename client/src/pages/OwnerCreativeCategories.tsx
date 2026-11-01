import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const pin = () => (typeof window === "undefined" ? "770562" : window.localStorage.getItem("abu-kayan-owner-pin") || "770562");

export default function OwnerCreativeCategories({ unlocked }: { unlocked: boolean }) {
  const query = trpc.creativeCategories.list.useQuery(undefined, { enabled: unlocked, staleTime: 0 });
  const utils = trpc.useUtils();
  const create = trpc.creativeCategories.createWithPin.useMutation({ onSuccess: () => { utils.creativeCategories.list.invalidate(); toast.success("تمت إضافة القسم ومزامنته."); } });
  const update = trpc.creativeCategories.updateWithPin.useMutation({ onSuccess: () => { utils.creativeCategories.list.invalidate(); toast.success("تم حفظ القسم."); } });
  const remove = trpc.creativeCategories.removeWithPin.useMutation({ onSuccess: () => { utils.creativeCategories.list.invalidate(); toast.success("تم حذف القسم."); } });
  if (!unlocked) return null;
  return <section className="owner-services-card owner-categories-card"><div className="owner-card-heading"><div><span className="studio-label">08 / أقسام الإبداع</span><h2>إدارة أقسام المشاركات</h2></div><button type="button" className="owner-add" onClick={() => create.mutate({ ownerPin: pin(), name: "قسم جديد", slug: `section-${Date.now()}`, sortOrder: (query.data?.length || 0) + 1, isVisible: true })}><Plus size={16} /> إضافة قسم</button></div><p className="owner-security-note">غيّر الاسم والترتيب أو أخفِ القسم. التعديلات تحفظ في قاعدة البيانات وتظهر للزوار على جميع الأجهزة.</p><div className="owner-category-list">{query.data?.map((category) => <div className="owner-category-row" key={category.id}><label><span>اسم القسم</span><input defaultValue={category.name} onBlur={(event) => update.mutate({ ownerPin: pin(), id: category.id, name: event.target.value })} /></label><label><span>الترتيب</span><input type="number" min="0" defaultValue={category.sortOrder} onBlur={(event) => update.mutate({ ownerPin: pin(), id: category.id, sortOrder: Number(event.target.value) })} /></label><label><span>الظهور</span><select defaultValue={category.isVisible === 1 ? "visible" : "hidden"} onChange={(event) => update.mutate({ ownerPin: pin(), id: category.id, isVisible: event.target.value === "visible" })}><option value="visible">ظاهر</option><option value="hidden">مخفي</option></select></label><button type="button" className="owner-delete" onClick={() => { if (window.confirm("حذف هذا القسم؟ ستبقى المشاركات محفوظة ضمن أخرى.")) remove.mutate({ ownerPin: pin(), id: category.id }); }} aria-label="حذف القسم"><Trash2 size={16} /></button><Save size={15} className="owner-category-save-mark" /></div>)}</div></section>;
}
