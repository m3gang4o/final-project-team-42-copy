import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { exampleApiRouter } from "./routers/example";
import { messagesApiRouter } from "./routers/messages";
import { usersApiRouter } from "./routers/users";

export const appRouter = createTRPCRouter({
  example: exampleApiRouter,
  messages: messagesApiRouter,
  users: usersApiRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
