import { describe, expect, it } from "vitest";
import { buildPublicationChanges } from "./workspacePublicationSummary";
import { materializePublishedSnapshot } from "./managementWorkspace";
const emptyCollections = () => ({ templates: [], freeSites: [], submissions: [], templateCategories: [], creativeCategories: [] });

describe("accurate publication summary", () => {
  it("counts added, modified and removed saved items rather than placeholder totals", () => {
    const before = {content:{heroTitle:"قديم",buttons:[{id:"a",label:"أ"},{id:"b",label:"ب"}]},collections:emptyCollections()};
    const after = {content:{heroTitle:"جديد",buttons:[{id:"a",label:"معدل"},{id:"c",label:"جديد"}]},collections:emptyCollections()};
    expect(buildPublicationChanges(before,after)).toEqual([
      {kind:"buttons",label:"الأزرار",added:1,updated:1,removed:1},
      {kind:"settings",label:"النصوص والمظهر والإعدادات",added:0,updated:1,removed:0},
    ]);
  });
  it("does not propose publication of drafts, inbox, waiting or cancelled posts", () => {
    const before={content:{pages:[]},collections:emptyCollections()};
    const after={content:{pages:[{id:"draft",status:"draft",visible:true}]},collections:{...emptyCollections(),submissions:[{id:1,status:"pending",isVisible:0,reviewState:"inbox"},{id:2,status:"approved",isVisible:1,reviewState:"waiting"},{id:3,status:"rejected",isVisible:0,reviewState:"cancelled"}]}};
    expect(buildPublicationChanges(before,materializePublishedSnapshot(after))).toEqual([]);
  });
  it("keeps legacy approved posts approved, but waiting states excluded", () => {
    const materialized=materializePublishedSnapshot({content:{},collections:{...emptyCollections(),submissions:[{id:1,status:"approved",isVisible:1,reviewState:"inbox"},{id:2,status:"approved",isVisible:1,reviewState:"waiting"}]}});
    expect(materialized.collections.submissions).toEqual([{id:1,status:"approved",isVisible:1,reviewState:"saved"}]);
  });
});
