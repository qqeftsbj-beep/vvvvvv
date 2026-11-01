import React, { ChangeEvent, FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Send, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function CreativeSpace() {
  const [form, setForm] = useState({ projectName: "", description: "", link: "", contact: "" });
  const [images, setImages] = useState<File[]>([]);
  const [sent, setSent] = useState(false);
  const submissions = trpc.creativeSpace.list.useQuery(undefined, { staleTime: 30_000 });
  const create = trpc.creativeSpace.create.useMutation({
    onSuccess: () => { setForm({ projectName: "", description: "", link: "", contact: "" }); setImages([]); setSent(true); submissions.refetch(); toast.success("تم إرسال مشاركتك للمراجعة."); },
    onError: (error) => toast.error(error.message || "تعذر إرسال المشاركة.")
  });

  const chooseImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter((file) => file.type.startsWith("image/"));
    if (selected.length > 4) return toast.error("يمكنك إضافة 4 صور كحد أقصى.");
    setImages(selected);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.projectName.trim() || !form.description.trim()) return toast.error("أدخل اسم المشروع ووصفه.");
    const imageData = await Promise.all(images.map(readDataUrl));
    create.mutate({ ...form, imageData });
  };

  return <main dir="rtl" className="creative-space-page">
    <header className="creative-space-header"><Link href="/" className="free-sites-back"><ArrowRight size={15} /> العودة للموقع</Link><div className="creative-space-brand"><Sparkles size={17} /> مساحتك للإبداع</div><span className="creative-space-mark">أبو كيان الجنيد</span></header>
    <section className="creative-space-hero"><span className="studio-label"><span className="free-sites-dot" /> مساحة للظهور</span><h1>شارك فكرتك<br /><em>بشكل يليق بها.</em></h1><p>قدّم مشروعك أو موهبتك أو خدمتك. نراجع المشاركات بعناية قبل عرضها للزوار.</p><a className="creative-space-cta" href="#submit"><Send size={16} /> أضف مشاركتك <ArrowLeft size={15} /></a></section>
    <section className="creative-space-layout">
      <form id="submit" className="creative-space-form" onSubmit={submit}><div className="creative-space-form-heading"><span className="studio-label">01 / أرسل مشاركتك</span><h2>عرّف الناس بما تصنع.</h2></div>
        {sent && <div className="creative-space-success"><Check size={17} /> وصلت مشاركتك وستظهر بعد الموافقة عليها.</div>}
        <label><span>اسم المشروع أو الخدمة *</span><input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} maxLength={255} placeholder="مثال: استوديو ورد" /></label>
        <label><span>التعريف بالمشروع *</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={5000} placeholder="اكتب وصفًا مختصرًا وواضحًا..." /></label>
        <label><span>رابط المشروع أو الحساب (اختياري)</span><input type="url" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></label>
        <label><span>بيانات التواصل (اختياري)</span><input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} maxLength={500} placeholder="واتساب أو بريد إلكتروني" /></label>
        <label className="creative-space-upload"><input type="file" accept="image/*" multiple onChange={chooseImages} /><span><ImagePlus size={18} /> أضف صورًا للمشروع</span><small>{images.length ? `${images.length} صور مختارة` : "اختياري · حتى 4 صور"}</small></label>
        <button className="creative-space-submit" type="submit" disabled={create.isPending}>{create.isPending ? "جارٍ الإرسال..." : "إرسال للمراجعة"} <Send size={15} /></button>
      </form>
      <div className="creative-space-library"><div className="creative-space-list-heading"><span className="studio-label">02 / المشاركات المنشورة</span><h2>مساحات صنعتها أفكار جميلة.</h2></div>{submissions.isLoading && <p className="creative-space-empty">جارٍ تحميل المشاركات...</p>}{!submissions.isLoading && !submissions.data?.length && <p className="creative-space-empty">ستظهر المشاركات المعتمدة هنا قريبًا.</p>}{submissions.data?.map((item) => <article className="creative-space-card" key={item.id}>{item.imageUrls?.map((url) => <img key={url} src={url} alt={item.projectName} loading="lazy" />)}<div className="creative-space-card-body"><span className="creative-space-card-kicker">مساحة إبداعية</span><h3>{item.projectName}</h3><p>{item.description}</p>{item.contact && <small>{item.contact}</small>}{item.link && <a href={item.link} target="_blank" rel="noreferrer">زيارة المشروع <ExternalLink size={14} /></a>}</div></article>)}</div>
    </section>
  </main>;
}
