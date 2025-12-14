import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { User } from "@/server/models/responses";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { usersTable } from "@/server/db/schema";
import { UserIdentity, UpdateUser } from "@/server/models/inputs";
import { Subject } from "@/server/models/auth";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

function getUserIdFromSubject(subject: Subject): number {
  return parseInt(subject.id.substring(0, 8), 16);
}

const getCurrentUser = protectedProcedure
  .output(User)
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const userId = getUserIdFromSubject(subject);

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    return User.parse(user);
  });

const getUser = publicProcedure
  .input(UserIdentity)
  .output(User)
  .query(async ({ input }) => {
    const { userId } = input;

    const user = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    return User.parse(user);
  });

const updateUser = protectedProcedure
  .input(UpdateUser)
  .output(User)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const userId = getUserIdFromSubject(subject);

    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.avatarUrl !== undefined) {
      updateData.avatar_url = input.avatarUrl;
    }

    if (Object.keys(updateData).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
      });
    }

    await db
      .update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, userId));

    const updatedUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });

    if (!updatedUser) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return User.parse(updatedUser);
  });

const createUser = publicProcedure
  .input(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().email(),
    })
  )
  .output(User)
  .mutation(async ({ input }) => {
    const { id, name, email } = input;

    const existingUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, id),
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
      });
    }

    const [newUser] = await db
      .insert(usersTable)
      .values({
        id,
        name,
        email,
      })
      .returning();

    return User.parse(newUser);
  });

export const usersApiRouter = createTRPCRouter({
  getCurrentUser: getCurrentUser,
  getUser: getUser,
  updateUser: updateUser,
  createUser: createUser,
});
