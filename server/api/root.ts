import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { exampleApiRouter } from "./routers/example";
import { messagesApiRouter } from "./routers/messages";
import { usersApiRouter } from "./routers/users";
import { groupsApiRouter } from "./routers/groups";

export const appRouter = createTRPCRouter({
  example: exampleApiRouter,
  messages: messagesApiRouter,
  users: usersApiRouter,
  groups: groupsApiRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
