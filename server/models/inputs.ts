import { z } from "zod";

export const GroupIdentity = z.object({ groupId: z.number().nullable() });

export const MessageIdentity = z.object({ messageId: z.number() });

export const NewMessage = z.object({
  groupId: z.number().nullable(),
  message: z.string().nullable(),
  attachmentUrl: z.string().nullable(),
});

export const NewGroup = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  isPrivate: z.boolean().default(false),
});

export const UpdateGroup = z.object({
  groupId: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const JoinGroup = z.object({
  groupId: z.number(),
});

export const UserIdentity = z.object({ userId: z.number() });

export const UpdateUser = z.object({
  name: z.string().optional(),
  avatarUrl: z.string().nullable().optional(),
});
