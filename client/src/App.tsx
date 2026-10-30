/*
  Design reminder — Editorial Desert Studio:
  Keep the public experience Arabic-first, warm, asymmetric, and editorial with Junaidi indigo accents.
*/

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TemplateStudio from "./pages/TemplateStudio";
import OwnerPanel from "./pages/OwnerPanel";
import OwnerInbox from "./pages/OwnerInbox";
import FreeSites from "./pages/FreeSites";
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/owner" component={OwnerPanel} />
      <Route path="/owner/inbox" component={OwnerInbox} />
      <Route path="/free-sites" component={FreeSites} />
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
