import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { exampleApiRouter } from "./routers/example";
import { messagesApiRouter } from "./routers/messages";

export const appRouter = createTRPCRouter({
  example: exampleApiRouter,
  messages: messagesApiRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
