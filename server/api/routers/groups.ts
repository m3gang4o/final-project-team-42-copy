import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { Group } from "@/server/models/responses";
import { db } from "@/server/db";
import { eq, desc, ilike, or } from "drizzle-orm";
import { groupsTable, membershipsTable } from "@/server/db/schema";
import { NewGroup, UpdateGroup } from "@/server/models/inputs";
import { Subject } from "@/server/models/auth";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

function getUserIdFromSubject(subject: Subject): number {
  return parseInt(subject.id.substring(0, 8), 16);
}

async function enforceGroupOwnership(subject: Subject, groupId: number) {
  const userId = getUserIdFromSubject(subject);

  const group = await db.query.groupsTable.findFirst({
    where: eq(groupsTable.id, groupId),
    columns: {
      id: true,
      owner_id: true,
    },
  });

  if (!group) {
    throw new TRPCError({
      code: "NOT_FOUND",
    });
  }

  if (group.owner_id !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
    });
  }
}

const getAllGroups = publicProcedure
  .input(
    z.object({
      search: z.string().optional(),
    }),
  )
  .output(Group.array())
  .query(async ({ input }) => {
    const { search } = input;

    let whereClause = undefined;
    if (search) {
      whereClause = or(
        ilike(groupsTable.name, `%${search}%`),
        ilike(groupsTable.description, `%${search}%`),
      );
    }

    const groups = await db.query.groupsTable.findMany({
      where: whereClause,
      orderBy: [desc(groupsTable.created_at)],
      columns: {
        id: true,
        name: true,
        description: true,
        owner_id: true,
        is_private: true,
        created_at: true,
      },
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
      },
    });

    return Group.array().parse(groups);
  });

const getUserGroups = protectedProcedure
  .output(Group.array())
  .query(async ({ ctx }) => {
    const { subject } = ctx;
    const userId = getUserIdFromSubject(subject);

    const memberships = await db.query.membershipsTable.findMany({
      where: eq(membershipsTable.user_id, userId),
      with: {
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            owner_id: true,
            is_private: true,
            created_at: true,
          },
          with: {
            owner: {
              columns: {
                id: true,
                name: true,
                email: true,
                avatar_url: true,
                created_at: true,
              },
            },
          },
        },
      },
    });

    const groups = memberships
      .map((m) => m.group)
      .filter((g) => g !== null) as (typeof memberships)[0]["group"][];

    return Group.array().parse(groups);
  });

const getGroupById = publicProcedure
  .input(z.object({ groupId: z.number() }))
  .output(Group)
  .query(async ({ input }) => {
    const { groupId } = input;

    const group = await db.query.groupsTable.findFirst({
      where: eq(groupsTable.id, groupId),
      columns: {
        id: true,
        name: true,
        description: true,
        owner_id: true,
        is_private: true,
        created_at: true,
      },
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    return Group.parse(group);
  });

const createGroup = protectedProcedure
  .input(NewGroup)
  .output(Group)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { name, description, isPrivate } = input;
    const userId = getUserIdFromSubject(subject);

    const [newGroup] = await db
      .insert(groupsTable)
      .values({
        name,
        description: description ?? null,
        owner_id: userId,
        is_private: isPrivate ?? false,
      })
      .returning({
        id: groupsTable.id,
        name: groupsTable.name,
        description: groupsTable.description,
        owner_id: groupsTable.owner_id,
        is_private: groupsTable.is_private,
        created_at: groupsTable.created_at,
      });

    const fullGroup = await db.query.groupsTable.findFirst({
      where: eq(groupsTable.id, newGroup.id),
      columns: {
        id: true,
        name: true,
        description: true,
        owner_id: true,
        is_private: true,
        created_at: true,
      },
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!fullGroup) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return Group.parse(fullGroup);
  });

const updateGroup = protectedProcedure
  .input(UpdateGroup)
  .output(Group)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { groupId, name, description, isPrivate } = input;

    await enforceGroupOwnership(subject, groupId);

    const updateData: Partial<typeof groupsTable.$inferInsert> = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    if (description !== undefined) {
      updateData.description = description ?? null;
    }

    if (isPrivate !== undefined) {
      updateData.is_private = isPrivate;
    }

    if (Object.keys(updateData).length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
      });
    }

    await db
      .update(groupsTable)
      .set(updateData)
      .where(eq(groupsTable.id, groupId));

    const updatedGroup = await db.query.groupsTable.findFirst({
      where: eq(groupsTable.id, groupId),
      columns: {
        id: true,
        name: true,
        description: true,
        owner_id: true,
        is_private: true,
        created_at: true,
      },
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
      },
    });

    if (!updatedGroup) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return Group.parse(updatedGroup);
  });

const deleteGroup = protectedProcedure
  .input(z.object({ groupId: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { groupId } = input;

    await enforceGroupOwnership(subject, groupId);

    await db.delete(groupsTable).where(eq(groupsTable.id, groupId));
  });

export const groupsApiRouter = createTRPCRouter({
  getAllGroups: getAllGroups,
  getUserGroups: getUserGroups,
  getGroupById: getGroupById,
  createGroup: createGroup,
  updateGroup: updateGroup,
  deleteGroup: deleteGroup,
});
