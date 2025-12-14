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
      eq(membershipsTable.user_id, userId),
      eq(membershipsTable.group_id, groupId),
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
        ? eq(messagesTable.group_id, groupId)
        : and(
            isNull(messagesTable.group_id),
            eq(messagesTable.author_id, userId),
          ),
      orderBy: [asc(messagesTable.created_at)],
      columns: {
        id: true,
        message: true,
        attachment_url: true,
        created_at: true,
        author_id: true,
        group_id: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            owner_id: true,
            is_private: true,
            created_at: true,
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
        group_id: groupId ?? null,
        author_id: userId,
        message: message ?? null,
        attachment_url: attachmentUrl ?? null,
      })
      .returning({
        id: messagesTable.id,
        message: messagesTable.message,
        attachment_url: messagesTable.attachment_url,
        created_at: messagesTable.created_at,
        author_id: messagesTable.author_id,
        group_id: messagesTable.group_id,
      });

    const fullMessage = await db.query.messagesTable.findFirst({
      where: eq(messagesTable.id, newMessage.id),
      columns: {
        id: true,
        message: true,
        attachment_url: true,
        created_at: true,
        author_id: true,
        group_id: true,
      },
      with: {
        author: {
          columns: {
            id: true,
            name: true,
            email: true,
            avatar_url: true,
            created_at: true,
          },
        },
        group: {
          columns: {
            id: true,
            name: true,
            description: true,
            owner_id: true,
            is_private: true,
            created_at: true,
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
        author_id: true,
        group_id: true,
      },
    });

    if (!message) {
      throw new TRPCError({
        code: "NOT_FOUND",
      });
    }

    if (message.author_id !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
      });
    }

    if (message.group_id !== null) {
      await enforceGroupMembership(subject, message.group_id);
    }

    await db.delete(messagesTable).where(eq(messagesTable.id, messageId));
  });

export const messagesApiRouter = createTRPCRouter({
  getMessages: getMessages,
  sendMessage: sendMessage,
  deleteMessage: deleteMessage,
});
