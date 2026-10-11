/*
  Design reminder — Editorial Desert Studio:
  Keep the public experience Arabic-first, warm, asymmetric, and editorial with Junaidi indigo accents.
*/

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { useEffect, useState } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TemplateStudio from "./pages/TemplateStudio";
import OwnerPanel from "./pages/OwnerPanel";
import OwnerInbox from "./pages/OwnerInbox";
import { loadSiteContent } from "./lib/siteContent";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/owner" component={OwnerPanel} />
      <Route path="/owner/inbox" component={OwnerInbox} />
      <Route path="/templates/gemini">
        <TemplateStudio toolName="Gemini" toolLabel="Gemini" />
      </Route>
      <Route path="/templates/chat-gbt">
        <TemplateStudio toolName="Chat GBT" toolLabel="Chat GBT" />
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [customCss, setCustomCss] = useState(() => loadSiteContent().settings.customCss);
  useEffect(() => {
    const sync = () => setCustomCss(loadSiteContent().settings.customCss);
    window.addEventListener("abu-kayan-content-updated", sync);
    return () => window.removeEventListener("abu-kayan-content-updated", sync);
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <TooltipProvider>
          <Toaster position="bottom-left" />
          <style id="owner-custom-css">{customCss}</style>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
