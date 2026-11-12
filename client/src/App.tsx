/*
  Design reminder — Editorial Desert Studio:
  Keep the public experience Arabic-first, warm, asymmetric, and editorial with Junaidi indigo accents.
*/

import React, { lazy, Suspense } from "react";
import { useSharedContentSync } from "@/hooks/useSharedContentSync";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import WelcomeMessage from "./components/WelcomeMessage";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
const TemplateStudio = lazy(() => import("./pages/TemplateStudio"));
const OwnerPanel = lazy(() => import("./pages/OwnerPanel"));
const OwnerPreview = lazy(() => import("./pages/OwnerPreview"));
const OwnerInbox = lazy(() => import("./pages/OwnerInbox"));
const FreeSites = lazy(() => import("./pages/FreeSites"));
const CreativeSpace = lazy(() => import("./pages/CreativeSpace"));
const CustomPage = lazy(() => import("./pages/CustomPage"));
function Router() {
  useSharedContentSync();
  const [pathname] = useLocation();
  // make sure to consider if you need authentication for certain routes
  return (
    <><WelcomeMessage pathname={pathname} /><Suspense fallback={<div dir="rtl" className="container py-12" role="status">جارٍ فتح الصفحة…</div>}><Switch>
      <Route path="/" component={Home} />
      <Route path="/owner" component={OwnerPanel} />
      <Route path="/owner/preview" component={OwnerPreview} />
      <Route path="/owner/inbox" component={OwnerInbox} />
      <Route path="/free-sites" component={FreeSites} />
      <Route path="/creative-space" component={CreativeSpace} />
      <Route path="/custom/:slug" component={CustomPage} />
      <Route path="/templates/gemini">
        <TemplateStudio toolName="Gemini" toolLabel="Gemini" />
      </Route>
      <Route path="/templates/chat-gbt">
        <TemplateStudio toolName="Chat GBT" toolLabel="Chat GBT" />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch></Suspense></>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
