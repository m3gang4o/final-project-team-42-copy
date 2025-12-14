import { z } from "zod";

const snakeToCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
};

function parseDate(val: unknown): Date {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (val && typeof val === 'object' && 'toISOString' in val) {
    return new Date((val as { toISOString: () => string }).toISOString());
  }
  return new Date();
}

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

const dateSchema = z.any().transform((val) => parseDate(val));

export const User = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.coerce.number(),
    name: z.string(),
    email: z.string(),
    avatarUrl: z.string().nullable().optional(),
    createdAt: dateSchema,
  }),
);

export const Group = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.coerce.number(),
    name: z.string(),
    description: z.string().nullable(),
    ownerId: z.coerce.number(),
    isPrivate: z.boolean(),
    createdAt: dateSchema,
    owner: User.optional(),
  }),
);

export const Message = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.coerce.number(),
    message: z.string().nullable(),
    attachmentUrl: z.string().nullable(),
    createdAt: dateSchema,
    authorId: z.coerce.number(),
    groupId: z.coerce.number().nullable(),
    author: User.optional().nullable(),
    group: Group.optional().nullable(),
  }),
);

export const Membership = z.preprocess(
  (data) => convertKeysToCamelCase(data),
  z.object({
    id: z.coerce.number(),
    userId: z.coerce.number(),
    groupId: z.coerce.number(),
    role: z.string(),
    joinedAt: dateSchema,
    user: User.optional(),
    group: Group.optional(),
  }),
);
