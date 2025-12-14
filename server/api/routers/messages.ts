import { createTRPCRouter, protectedProcedure } from "../trpc";
import { Message } from "@/server/models/responses";
import { db } from "@/server/db";
import { asc, eq, isNull, and } from "drizzle-orm";
import { messagesTable, membershipsTable } from "@/server/db/schema";
import {
  GroupIdentity,
  MessageIdentity,
  NewMessage,
} from "@/server/models/inputs";
import { Subject } from "@/server/models/auth";
import { TRPCError } from "@trpc/server";

function getUserIdFromSubject(subject: Subject): number {
  return parseInt(subject.id.substring(0, 8), 16);
}

async function enforceGroupMembership(
  subject: Subject,
  groupId: number,
) {
  const userId = getUserIdFromSubject(subject);

  const membership = await db.query.membershipsTable.findFirst({
    where: and(
      eq(membershipsTable.userId, userId),
      eq(membershipsTable.groupId, groupId),
    ),
  });

  if (!membership) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
    });
  }
}

const getMessages = protectedProcedure
  .input(GroupIdentity)
  .output(Message.array())
  .query(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { groupId } = input;
    const userId = getUserIdFromSubject(subject);

    if (groupId !== null) {
      await enforceGroupMembership(subject, groupId);
    }

    const messages = await db.query.messagesTable.findMany({
      where: groupId !== null 
        ? eq(messagesTable.groupId, groupId)
        : and(
            isNull(messagesTable.groupId),
            eq(messagesTable.authorId, userId),
          ),
      orderBy: [asc(messagesTable.createdAt)],
      columns: {
        id: true,
        message: true,
        attachmentUrl: true,
        createdAt: true,
        authorId: true,
        groupId: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
    });

    return Message.array().parse(messages);
  });

const sendMessage = protectedProcedure
  .input(NewMessage)
  .output(Message)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { groupId, message, attachmentUrl } = input;

    if (groupId !== null) {
      await enforceGroupMembership(subject, groupId);
    }

    if (!message && !attachmentUrl) {
      throw new TRPCError({
        code: "BAD_REQUEST",
      });
    }

    const userId = getUserIdFromSubject(subject);

    const [newMessage] = await db
      .insert(messagesTable)
      .values({
        groupId: groupId ?? null,
        authorId: userId,
        message: message ?? null,
        attachmentUrl: attachmentUrl ?? null,
      })
      .returning({
        id: messagesTable.id,
        message: messagesTable.message,
        attachmentUrl: messagesTable.attachmentUrl,
        createdAt: messagesTable.createdAt,
        authorId: messagesTable.authorId,
        groupId: messagesTable.groupId,
      });

    const fullMessage = await db.query.messagesTable.findFirst({
      where: eq(messagesTable.id, newMessage.id),
      columns: {
        id: true,
        message: true,
        attachmentUrl: true,
        createdAt: true,
        authorId: true,
        groupId: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            isPrivate: true,
            createdAt: true,
          },
        },
      },
    });

    if (!fullMessage) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
      });
    }

    return Message.parse(fullMessage);
  });

const deleteMessage = protectedProcedure
  .input(MessageIdentity)
  .mutation(async ({ ctx, input }) => {
    const { subject } = ctx;
    const { messageId } = input;

    const userId = getUserIdFromSubject(subject);

    const message = await db.query.messagesTable.findFirst({
      where: eq(messagesTable.id, messageId),
      columns: {
        authorId: true,
        groupId: true,
      },
    });

    if (!message) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    if (message.authorId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
      });
    }

    if (message.groupId !== null) {
      await enforceGroupMembership(subject, message.groupId);
    }

    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  });

export const messagesApiRouter = createTRPCRouter({
  getMessages: getMessages,
  sendMessage: sendMessage,
  deleteMessage: deleteMessage,
});
