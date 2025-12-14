import { z } from "zod";

const snakeToCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

function convertKeysToCamelCase<T>(input: T): T {
  if (Array.isArray(input)) {
    return input.map(convertKeysToCamelCase) as unknown as T;
  } else if (input !== null && typeof input === "object") {
    if (input instanceof Date) {
      return input;
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      input as Record<string, unknown>
    )) {
      const camelKey = snakeToCamelCase(key);
      result[camelKey] = convertKeysToCamelCase(value);
    }
    return result as T;
  }
  return input;
}

export const User = z.preprocess(
  (data) => {
    const converted = convertKeysToCamelCase(data);
    if (converted && typeof converted === 'object' && 'id' in converted) {
      const obj = converted as any;
      if (typeof obj.id === 'string') {
        obj.id = parseInt(obj.id, 10);
      }
    }
    return converted;
  },
  z.object({
    id: z.number(),
    name: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable().optional(),
    createdAt: z.coerce.date(),
  }),
);

export const Group = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  ownerId: z.number(),
  isPrivate: z.boolean(),
  createdAt: z.date({ coerce: true }),
  owner: User.optional(),
});

export const Message = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.number(),
    message: z.string().nullable(),
    attachmentUrl: z.string().nullable(),
    createdAt: z.date({ coerce: true }),
    authorId: z.number(),
    groupId: z.number().nullable(),
    author: User.optional(),
    group: Group.optional(),
  }),
);

export const Membership = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.number(),
    userId: z.number(),
    groupId: z.number(),
    role: z.string(),
    joinedAt: z.date({ coerce: true }),
    user: User.optional(),
    group: Group.optional(),
  }),
);
