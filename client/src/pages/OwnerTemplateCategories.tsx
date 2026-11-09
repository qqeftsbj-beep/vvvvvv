import React from "react";
import OwnerCategoryWorkspace, { type CategoryWorkspaceProps } from "./OwnerCategoryWorkspace";
export function reorderTemplateCategoryIds(ids:number[],from:number,to:number){const next=[...ids];if(from===to||from<0||to<0||from>=next.length||to>=next.length)return next;const [moved]=next.splice(from,1);next.splice(to,0,moved);return next;}
export default function OwnerTemplateCategories(props:CategoryWorkspaceProps & {tool:"Gemini"|"Chat GBT"}){return <OwnerCategoryWorkspace {...props}/>;}
