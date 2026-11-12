import { publicProcedure, router } from "./_core/trpc";
import { getPublishedSnapshot } from "./managementWorkspace";
import { selectWelcomeTemplate, welcomeConfigFrom } from "../shared/welcomeSchedule";

export const welcomeRouter = router({
  active: publicProcedure.query(async () => {
    const published = await getPublishedSnapshot(false);
    return { template: selectWelcomeTemplate(welcomeConfigFrom(published.content.welcome), Date.now()) };
  }),
});
