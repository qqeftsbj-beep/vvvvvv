import React, { useState } from "react";
import { Archive, RotateCcw, Eye } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { SiteContent } from "@/lib/siteContent";
import { normalizeSiteContent } from "@/lib/siteContent";
export default function OwnerBackups({
  ownerPin,
  onRestore,
}: {
  ownerPin: string;
  onRestore: (content: SiteContent) => void;
}) {
  const history = trpc.siteContent.history.useQuery(
    { ownerPin },
    { staleTime: 0, refetchOnWindowFocus: true }
  );
  const backup = trpc.siteContent.backup.useMutation({
    onSuccess: () => {
      history.refetch();
      toast.success("تم تأكيد حفظ النسخة الاحتياطية في قاعدة البيانات.");
    },
    onError: error => toast.error(error.message),
  });
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<{
    id: number;
    content: SiteContent;
  } | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const view = async (id: number) => {
    setLoadingId(id);
    try {
      const value = await utils.siteContent.version.fetch({ ownerPin, id });
      setSelected({ id, content: normalizeSiteContent(value) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر فتح النسخة.");
    } finally {
      setLoadingId(null);
    }
  };
  return (
    <section className="owner-services-card">
      <div className="owner-card-heading">
        <div>
          <span className="studio-label">
            سجل مركزي محفوظ في قاعدة البيانات
          </span>
          <h2>نسخ الموقع واستعادته</h2>
        </div>
        <button
          type="button"
          className="owner-add"
          onClick={() => backup.mutate({ ownerPin })}
          disabled={backup.isPending}
        >
          <Archive size={16} />{" "}
          {backup.isPending ? "جارٍ الحفظ…" : "نسخة احتياطية الآن"}
        </button>
      </div>
      <p className="owner-security-note">
        يؤرشف النظام الحالة السابقة تلقائيًا قبل كل حفظ. يُحتفظ بآخر 20 نسخة
        للإعدادات والصفحات والأزرار ومراجع الصور. القوالب والمشاركات تُدار في
        أقسامها وسلة المحذوفات. الاستعادة هنا تعرض مسودة أولًا ولا تتغير الواجهة
        العامة حتى تضغط «حفظ التعديلات».
      </p>
      {history.error && (
        <p role="alert" className="owner-save-error">
          {history.error.message}
        </p>
      )}
      {history.isLoading && <p>جارٍ تحميل السجل…</p>}
      <div className="owner-backup-list">
        {history.data?.map(item => (
          <div className="owner-backup-row" key={item.id}>
            <span>
              نسخة {item.id} ·{" "}
              {new Date(item.createdAt).toLocaleString("ar-YE")}
            </span>
            <button
              type="button"
              className="owner-add"
              onClick={() => view(item.id)}
              disabled={loadingId !== null}
            >
              <Eye size={16} />{" "}
              {loadingId === item.id ? "جارٍ الفتح…" : "معاينة"}
            </button>
          </div>
        ))}
        {!history.isLoading && !history.data?.length && (
          <p className="owner-empty">
            لم تُنشأ نسخ مركزية بعد. يمكنك إنشاء نسخة الآن.
          </p>
        )}
      </div>
      {selected && (
        <div className="owner-managed-body">
          <h3>معاينة النسخة {selected.id}</h3>
          <p>
            {selected.content.heroTitle} · {selected.content.pages.length} صفحة
            · {selected.content.buttons.length} زر ·{" "}
            {selected.content.services.length} خدمة
          </p>
          <div className="owner-item-toolbar">
            <button
              type="button"
              className="owner-add"
              onClick={() => {
                if (
                  window.confirm(
                    "تحميل هذه النسخة كمسودة؟ لن تنشر إلا بعد حفظ التعديلات، وستؤرشف الحالة الحالية عند الحفظ."
                  )
                ) {
                  onRestore(selected.content);
                  setSelected(null);
                }
              }}
            >
              <RotateCcw size={16} /> تحميل كمسودة للاستعادة
            </button>
            <button
              type="button"
              className="owner-add"
              onClick={() => setSelected(null)}
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
