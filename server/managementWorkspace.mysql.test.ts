import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mysql, { type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import fs from "node:fs";
const handle=vi.hoisted(()=>({db:null as any}));
vi.mock("./db",()=>({getDb:async()=>handle.db}));
import { getWorkingState, getPublishedSnapshot, saveWorkspace, publishWorkspace, createWorkingEntity, updateWorkingEntity, removeWorkingEntity, listTrash, restoreTrash, purgeTrash, listHistory, readVersion, restoreVersion, deleteVersion, reorderWorkingEntities } from "./managementWorkspace";

// Real MySQL transaction/readback checks; every table referenced by the repository
// is shadowed in this connection by a TEMPORARY table. Live tables are never edited.
describe.skipIf(!process.env.DATABASE_URL)("management workspace real MySQL isolated persistence",()=>{
  let connection:Connection;let ready=false;
  const originalTables=["site_settings","shared_templates","free_sites","creative_submissions","template_categories","creative_categories","site_content_versions"];
  const newTables=["management_workspaces","management_trash","management_backups"];
  const content={heroTitle:"النسخة العامة الأصلية",settings:{},buttons:[{id:"original-button",label:"الزر الأصلي",action:"gemini"}],pages:[{id:"page-1",slug:"isolated-native-test",title:"صفحة أصلية",status:"published",visible:true,renderMode:"code",customCode:{enabled:true,html:"<h1>PUBLIC ORIGINAL</h1>",css:"",js:""},blocks:[{id:"block-1",type:"text",title:"عنصر أصلي",text:"محتوى محفوظ"}],media:[{id:"file-1",name:"ملف مشترك",key:"unchanged-storage-key",url:"/api/page-media/file-1/view"}]}],services:[{id:"service-1",title:"الخدمة الأصلية"}],products:[]};
  beforeAll(async()=>{
    connection=await mysql.createConnection(process.env.DATABASE_URL!);
    try {
      for(const name of originalTables){
        const [definition]:any=await connection.query(`SHOW CREATE TABLE \`${name}\``);
        let ddl=String(definition[0]["Create Table"]).replace("CREATE TABLE","CREATE TEMPORARY TABLE");
        if(name==="creative_submissions" && !ddl.includes("`reviewState`"))ddl=ddl.replace("(\n","(\n  `reviewState` enum('inbox','saved','waiting','cancelled') NOT NULL DEFAULT 'inbox',\n");
        await connection.query(ddl);
      }
      const sql=fs.readFileSync(new URL("../drizzle/0011_orange_dragon_lord.sql",import.meta.url),"utf8");
      for(const name of newTables){const match=sql.match(new RegExp("CREATE TABLE `"+name+"`[\\s\\S]*?;"));if(!match)throw new Error("Temporary schema missing "+name);let ddl=match[0].replace("CREATE TABLE","CREATE TEMPORARY TABLE");if(name==="management_workspaces"&&!ddl.includes("`metadataJson`"))ddl=ddl.replace("(\n","(\n  `metadataJson` mediumtext NOT NULL,\n");await connection.query(ddl);}
      handle.db=drizzle(connection);ready=true;
    } catch(error){await connection.end();throw error;}
  },30000);
  beforeEach(async()=>{
    if(!ready)throw new Error("Temporary table isolation was not initialized");
    for(const name of [...newTables,...originalTables])await connection.query(`DELETE FROM \`${name}\``);
    await connection.execute("INSERT INTO site_settings (id,contentJson) VALUES (1,?)",[JSON.stringify(content)]);
    await connection.execute("INSERT INTO creative_submissions (id,projectName,description,category,status,isVisible,sortOrder) VALUES (41,'وارد محفوظ','تعريف مشروع أصلي','design','pending',0,0)");
    await connection.execute("INSERT INTO shared_templates (id,tool,text,imageUrl,imageKey,imageName,mediaType,category,createdByOpenId) VALUES (7,'Gemini','تصميم أصلي','/manus-storage/original.png','original-key','original.png','image','weddings','owner')");
    await connection.execute("INSERT INTO free_sites (id,name,url,createdByOpenId) VALUES (5,'موقع أصلي','https://example.com','owner')");
    await connection.execute("INSERT INTO site_content_versions (contentJson) VALUES (?)",[JSON.stringify({...content,heroTitle:"نسخة قديمة قابلة للاستعادة"})]);
  },30000);
  afterAll(async()=>{handle.db=null;if(ready)await connection.end();});

  it("preserves legacy approved guest posts while keeping pending arrivals private",async()=>{
    await connection.execute("INSERT INTO creative_submissions (id,projectName,description,category,status,isVisible,sortOrder) VALUES (42,'منشور قديم','تعريف منشور قديم','design','approved',1,0)");
    const published=await getPublishedSnapshot();
    expect(published.collections.submissions.map((item:any)=>item.id)).toContain(42);
    expect(published.collections.submissions.map((item:any)=>item.id)).not.toContain(41);
    expect((await getWorkingState()).collections.submissions.map((item:any)=>item.id)).toContain(42);
  });
  it("saves category order atomically and preserves design category references",async()=>{
    await getWorkingState();
    const a=await createWorkingEntity("templateCategories",{tool:"Gemini",name:"الأول",slug:"weddings",sortOrder:1,isVisible:1});
    const b=await createWorkingEntity("templateCategories",{tool:"Gemini",name:"الثاني",slug:"second",sortOrder:2,isVisible:1});
    const child=await createWorkingEntity("templateCategories",{tool:"Chat GBT",name:"أطفال",slug:"children",sortOrder:1,isVisible:1});
    const revision=(await getWorkingState()).revision;
    await expect(reorderWorkingEntities("templateCategories",[a.id,child.id],"Gemini")).rejects.toThrow();
    expect((await getWorkingState()).revision).toBe(revision);
    await reorderWorkingEntities("templateCategories",[b.id,a.id],"Gemini");
    expect((await getWorkingState()).collections.templateCategories.filter((row:any)=>row.tool==="Gemini").map((row:any)=>row.id)).toEqual([b.id,a.id]);
    await updateWorkingEntity("templateCategories",a.id,{slug:"renamed"});
    expect((await getWorkingState()).collections.templates[0].category).toBe("renamed");
    await publishWorkspace((await getWorkingState()).revision,true);
    expect((await getPublishedSnapshot()).collections.templateCategories.filter((row:any)=>row.tool==="Gemini").map((row:any)=>row.id)).toEqual([b.id,a.id]);
  });
  it("persists repeated private saves while guests see the original until explicit revision publication",async()=>{
    const first=await getWorkingState();expect(first.content.heroTitle).toBe(content.heroTitle);
    const saved=await saveWorkspace({...first.content,heroTitle:"عنوان خاص محفوظ"});
    const [[raw]]:any=await connection.query("SELECT workingContentJson,publishedContentJson FROM management_workspaces WHERE id=1");
    expect(JSON.parse(raw.workingContentJson).heroTitle).toBe("عنوان خاص محفوظ");expect(JSON.parse(raw.publishedContentJson).heroTitle).toBe(content.heroTitle);
    expect((await getWorkingState()).content.heroTitle).toBe("عنوان خاص محفوظ");expect((await getPublishedSnapshot()).content.heroTitle).toBe(content.heroTitle);
    await expect(publishWorkspace(saved.revision,false)).rejects.toThrow();
    const second=await saveWorkspace({...saved.content,heroTitle:"عنوان خاص ثانٍ"});
    await expect(publishWorkspace(saved.revision,true)).rejects.toThrow();
    await publishWorkspace(second.revision,true);
    expect((await getPublishedSnapshot()).content.heroTitle).toBe("عنوان خاص ثانٍ");
    const history=await listHistory();expect(history.some(item=>item.type==="published")).toBe(true);
    const [[legacy]]:any=await connection.query("SELECT contentJson FROM site_settings WHERE id=1");expect(JSON.parse(legacy.contentJson)).toEqual(content);
  });
  it("restores trash from several collections and nested page media/blocks without deleting shared object keys",async()=>{
    const first=await getWorkingState();const changed=JSON.parse(JSON.stringify(first.content));changed.buttons=[];changed.services=[];changed.pages[0].blocks=[];changed.pages[0].media=[];
    await saveWorkspace(changed);await removeWorkingEntity("templates",7);await removeWorkingEntity("freeSites",5);
    const entries=await listTrash();expect(entries.length).toBeGreaterThanOrEqual(6);expect(entries.some(item=>JSON.stringify(item.value).includes("unchanged-storage-key"))).toBe(true);
    expect((await getPublishedSnapshot()).collections.templates).toHaveLength(1);
    for(const entry of entries)await restoreTrash(entry.id);
    const restored=await getWorkingState();expect((restored.content.buttons as any[])[0].id).toBe("original-button");expect((restored.content.pages as any[])[0].blocks[0].id).toBe("block-1");expect((restored.content.pages as any[])[0].media[0].key).toBe("unchanged-storage-key");expect(restored.collections.templates.some(row=>row.id===7)).toBe(true);
  });
  it("keeps cancelled and waiting states private and does not recreate deleted pending guest submissions",async()=>{
    await getWorkingState();await updateWorkingEntity("submissions",41,{reviewState:"waiting",status:"pending",isVisible:0});
    expect((await getWorkingState()).collections.submissions[0].reviewState).toBe("waiting");
    await removeWorkingEntity("submissions",41);expect((await getWorkingState()).collections.submissions).toHaveLength(0);
    const entry=(await listTrash()).find(item=>(item.value as any)?.id===41)!;await expect(purgeTrash(entry.id,false)).rejects.toThrow();await purgeTrash(entry.id,true);
    expect((await getWorkingState()).collections.submissions).toHaveLength(0);
    const [[original]]:any=await connection.query("SELECT COUNT(*) AS n FROM creative_submissions WHERE id=41");expect(Number(original.n)).toBe(1);
  });
  it("never reuses a removed ID and preserves all collections on legacy backup restore",async()=>{
    await getWorkingState();await removeWorkingEntity("templates",7);
    const created=await createWorkingEntity("templates",{tool:"Gemini",text:"تصميم جديد",imageUrl:"/manus-storage/new.png",imageKey:"new-key",imageName:"new.png",category:"weddings",mediaType:"image",createdByOpenId:"owner"});expect(created.id).not.toBe(7);
    const history=await listHistory();const legacy=history.find(item=>item.type==="legacy")!;const before=await getWorkingState();
    await restoreVersion(legacy.id);const after=await getWorkingState();expect(after.collections).toEqual(before.collections);expect(after.content.heroTitle).toBe("نسخة قديمة قابلة للاستعادة");expect((await getPublishedSnapshot()).content.heroTitle).toBe(content.heroTitle);
    const recovery=(await listHistory()).find(item=>item.type==="working-before-restore")!;expect((await readVersion(recovery.id))?.collections.templates).toHaveLength(before.collections.templates.length);
    await expect(deleteVersion(recovery.id,false)).rejects.toThrow();await deleteVersion(recovery.id,true);expect(await readVersion(recovery.id)).toBeNull();
  });
});
