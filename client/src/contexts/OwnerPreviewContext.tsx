import React, { createContext, useContext } from "react";
import type { SiteContent } from "@/lib/siteContent";
import type { SharedTemplate, FreeSite, TemplateCategory, CreativeCategory, CreativeSubmission } from "../../../drizzle/schema";
export type PreviewCollections = {
  templates: SharedTemplate[]; freeSites: FreeSite[];
  submissions: Array<Omit<CreativeSubmission,"imageUrls"> & { imageUrls: string[]; reviewState?: string }>;
  templateCategories: TemplateCategory[]; creativeCategories: CreativeCategory[];
};
export type OwnerPreviewData = { content: SiteContent; collections: PreviewCollections; navigate: (url:string)=>void };
const OwnerPreviewContext = createContext<OwnerPreviewData | null>(null);
export const OwnerPreviewProvider = OwnerPreviewContext.Provider;
export const useOwnerPreview = () => useContext(OwnerPreviewContext);
