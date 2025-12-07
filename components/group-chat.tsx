import React, { useEffect, useRef, useState } from "react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Loader2Icon, Send, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Subject } from "@/server/models/auth";

export type GroupChatGroup = {
  id: number;
  name: string;
  description: string | null;
};
export type GroupChatProps = {
  group: GroupChatGroup;
  user: Subject | null;
  authorId: number | null;
};

export type GroupMessage = {
  id: number;
  message: string;
  attachment_url: string | null;
  created_at: string;
  author_id: number | null;
  author: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

type RawMessageRow = {
  id: number;
  message: string;
  attachment_url: string | null;
  created_at: string;
  author_id: number | null;
  author: { name: string | null; avatar_url: string | null }[] | null;
};

type RawMembershipRow = {
  user_id: string | number;
  users:
    | { id: string; name: string; avatar_url: string | null }
    | { id: string; name: string; avatar_url: string | null }[];
};

const PAGE_SIZE = 20;

const uploadPostFileToSupabase = async (
  supabase: SupabaseClient,
  userId: number,
  file: File,
  onSuccess: (attachmentUrl: string) => void,
) => {
  const currentTimestamp = Date.now().toString();
  const { data: fileData, error: uploadError } = await supabase.storage
    .from("images")
    .upload(`upload_${userId}_${currentTimestamp}`, file);

  if (uploadError) {
    console.error({
      code: "INTERNAL_SERVER_ERROR",
      message: `Failed to upload file to Supabase: ${uploadError.message}`,
    });
  } else if (!fileData) {
    console.error({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not find data after uploading file to Supabase.",
    });
  } else {
    onSuccess(fileData.path);
  }
};

export function GroupChat({ group, user, authorId }: GroupChatProps) {
  const supabase = createSupabaseComponentClient();

  const [draftText, setDraftText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [groupMembers, setGroupMembers] = useState<
    { id: string; name: string; avatar_url: string | null }[]
  >([]);
  const [onlineMembers, setOnlineMembers] = useState<string[]>([]);

  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const refreshMessages = async () => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          message,
          attachment_url,
          created_at,
          author_id,
          author:users!messages_author_id_fkey(
            name,
            avatar_url
          )
        `,
        )
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) throw error;

      const transformedData = (data ?? []).map((msg: RawMessageRow) => {
        const author = Array.isArray(msg.author)
          ? msg.author[0] || null
          : msg.author || null;

        return {
          id: msg.id,
          message: msg.message,
          attachment_url: msg.attachment_url,
          created_at: msg.created_at,
          author_id: msg.author_id,
          author: author
            ? {
                name: author.name || "Anonymous",
                avatar_url: author.avatar_url,
              }
            : null,
        } as GroupMessage;
      });

      setMessages(transformedData);
      setCursor(transformedData.length);
      setHasMore(transformedData.length === PAGE_SIZE);

      // Auto-scroll to bottom
      setTimeout(() => messageEndRef.current?.scrollIntoView(), 0);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadMoreMessages = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `
          id,
          message,
          attachment_url,
          created_at,
          author_id,
          author:users!messages_author_id_fkey(
            name,
            avatar_url
          )
        `,
        )
        .eq("group_id", group.id)
        .order("created_at", { ascending: false })
        .range(cursor, cursor + PAGE_SIZE - 1);

      if (error) throw error;

      const newMessages = (data ?? []).map((msg: RawMessageRow) => {
        const author = Array.isArray(msg.author)
          ? msg.author[0] || null
          : msg.author || null;

        return {
          id: msg.id,
          message: msg.message,
          attachment_url: msg.attachment_url,
          created_at: msg.created_at,
          author_id: msg.author_id,
          author: author
            ? {
                name: author.name || "Anonymous",
                avatar_url: author.avatar_url,
              }
            : null,
        } as GroupMessage;
      });

      setMessages((prev) => [...prev, ...newMessages]);
      setCursor((prev) => prev + newMessages.length);
      if (newMessages.length < PAGE_SIZE) setHasMore(false);
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const loadMembers = async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select(
          `
        user_id,
        users (
          id,
          name,
          avatar_url
        )
      `,
        )
        .eq("group_id", group.id);

      if (error) {
        console.error("Error loading group members:", error);
        return;
      }

      const members = (data ?? [])
        .map((row: RawMembershipRow) => {
          const userRow = Array.isArray(row.users) ? row.users[0] : row.users;
          if (!userRow) return null;

          return {
            id: String(userRow.id), // <- normalize to string
            name: userRow.name,
            avatar_url: userRow.avatar_url,
          };
        })
        .filter(
          (m): m is { id: string; name: string; avatar_url: string | null } =>
            m !== null,
        );

      setGroupMembers(members);
    };

    loadMembers();
  }, [group.id, supabase]);

  useEffect(() => {
    if (authorId == null) return;

    const presenceKey = String(authorId);

    const channel = supabase.channel(`presence-group-${group.id}`, {
      config: {
        presence: {
          key: presenceKey, // <- use users.id as the presence key
        },
      },
    });

    // Sync event: refresh full state
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const online = Object.keys(state); // keys are presenceKey values
      setOnlineMembers(online);
    });

    // Join event
    channel.on("presence", { event: "join" }, ({ key }) => {
      setOnlineMembers((prev) => (prev.includes(key) ? prev : [...prev, key]));
    });

    // Leave event
    channel.on("presence", { event: "leave" }, ({ key }) => {
      setOnlineMembers((prev) => prev.filter((id) => id !== key));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user_id: presenceKey, // <- track same ID as string
        });
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [group.id, authorId, supabase]);

  useEffect(() => {
    refreshMessages();
  }, [group.id]);

  const publishMessage = async () => {
    if (!draftText.trim() && !selectedFile) {
      return;
    }

    if (authorId == null) return;

    setIsPosting(true);

    let attachmentUrl: string | null = null;

    try {
      if (selectedFile) {
        await new Promise<void>((resolve) => {
          uploadPostFileToSupabase(supabase, authorId, selectedFile, (url) => {
            attachmentUrl = url;
            resolve();
          });
        });
      }

      const { error } = await supabase.from("messages").insert({
        message: draftText || selectedFile?.name || "Untitled",
        attachment_url: attachmentUrl,
        author_id: authorId,
        group_id: group.id,
      });

      if (error) throw error;

      setDraftText("");
      setSelectedFile(null);
      await refreshMessages();
    } catch (err) {
      console.error("Error publishing message:", err);
    } finally {
      setIsPosting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const canPost = !!user && authorId != null;

  const activeMembers = groupMembers.filter((m) =>
    onlineMembers.includes(m.id),
  );
  const inactiveMembers = groupMembers.filter(
    (m) => !onlineMembers.includes(m.id),
  );

  const handleDeleteMessage = async (messageId: number) => {
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      // Optimistically update local state
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  return (
    <div className="flex h-full gap-4">
      <div className="border-border bg-card flex h-full flex-grow-3 flex-col overflow-hidden rounded-lg border">
        {/* MESSAGE LIST */}
        <div
          className="flex-1 overflow-y-auto"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          aria-atomic="false"
        >
          <div className="flex flex-col-reverse gap-4 p-4">
            <div ref={messageEndRef} />

            {loadingMessages ? (
              <div
                className="flex h-40 items-center justify-center"
                role="status"
                aria-live="polite"
              >
                <Loader2Icon
                  className="h-6 w-6 animate-spin"
                  aria-hidden="true"
                />
                <span className="sr-only">Loading messages...</span>
              </div>
            ) : messages.length === 0 ? (
              <p
                className="text-muted-foreground text-center text-sm"
                role="status"
              >
                No messages yet. Be the first to post!
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  <Avatar className="h-9 w-9">
                    {msg.author?.avatar_url ? (
                      <AvatarImage
                        src={msg.author.avatar_url}
                        alt={`${msg.author?.name || "User"}'s avatar`}
                      />
                    ) : (
                      <AvatarFallback
                        aria-label={`${msg.author?.name || "User"}'s avatar`}
                      >
                        {msg.author?.name?.charAt(0)?.toUpperCase() ??
                          String(msg.id).slice(-1)}
                      </AvatarFallback>
                    )}
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-foreground font-semibold">
                        {msg.author?.name}
                      </p>
                      <span className="text-muted-foreground text-xs">
                        {formatTime(msg.created_at)}
                      </span>
                      {authorId != null && msg.author_id === authorId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6"
                          onClick={() => handleDeleteMessage(msg.id)}
                          aria-label={`Delete message from ${formatTime(msg.created_at)}`}
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </Button>
                      )}
                    </div>

                    <p className="text-foreground mt-1 break-words whitespace-pre-wrap">
                      {msg.message}
                    </p>

                    {msg.attachment_url && (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-sm text-blue-600 underline"
                        aria-label={`View attachment: ${msg.attachment_url.split("/").pop() || "attachment"}`}
                      >
                        View Attachment
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}

            {hasMore && !loadingMessages && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  aria-label={
                    loadingMore ? "Loading more messages" : "Load more messages"
                  }
                >
                  {loadingMore ? (
                    <>
                      <Loader2Icon
                        className="mr-2 h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      Loading...
                    </>
                  ) : (
                    "Load more"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* COMPOSER BAR */}
        <div className="border-border bg-card border-t p-4">
          <div className="flex items-end gap-3">
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 resize-none"
              disabled={!canPost}
              aria-label="Type your message"
              aria-describedby={!canPost ? "post-disabled-help" : undefined}
            />
            {!canPost && (
              <span id="post-disabled-help" className="sr-only">
                You must be logged in to post messages
              </span>
            )}

            <div className="flex flex-col gap-2">
              {/* Hidden file input */}
              <Input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                aria-label="Upload image file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSelectedFile(file);
                }}
              />

              {/* File button */}
              <Button
                variant="secondary"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={!canPost}
                aria-label="Attach image"
              >
                <ImagePlus className="h-4 w-4" aria-hidden="true" />
              </Button>

              {/* Send button */}
              <Button
                variant="secondary"
                size="icon"
                onClick={publishMessage}
                disabled={
                  !canPost || isPosting || (!draftText.trim() && !selectedFile)
                }
                aria-label={isPosting ? "Sending message" : "Send message"}
              >
                {isPosting ? (
                  <Loader2Icon
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {selectedFile && (
            <div
              className="mt-2 flex items-center gap-2 text-sm"
              role="status"
              aria-live="polite"
            >
              <span
                className="max-w-[200px] truncate"
                aria-label={`Selected file: ${selectedFile.name}`}
              >
                {selectedFile.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
                aria-label={`Remove ${selectedFile.name}`}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
      <aside
        className="border-border bg-card mb-4 rounded-lg border p-4"
        aria-label="Group members"
      >
        <h3 className="text-foreground mb-2 font-semibold">Active Members</h3>
        {activeMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active members</p>
        ) : (
          activeMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={m.avatar_url ?? undefined}
                  alt={`${m.name}'s avatar`}
                />
                <AvatarFallback aria-label={`${m.name}'s avatar`}>
                  {m.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground text-sm">{m.name}</span>
              <span className="text-xs text-green-500" aria-label="online">
                ● online
              </span>
            </div>
          ))
        )}

        <h3 className="text-foreground mt-4 mb-2 font-semibold">
          Offline Members
        </h3>
        {inactiveMembers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Everyone is online!</p>
        ) : (
          inactiveMembers.map((m) => (
            <div key={m.id} className="flex items-center gap-2 py-1">
              <Avatar className="h-7 w-7">
                <AvatarImage
                  src={m.avatar_url ?? undefined}
                  alt={`${m.name}'s avatar`}
                />
                <AvatarFallback aria-label={`${m.name}'s avatar`}>
                  {m.name[0]}
                </AvatarFallback>
              </Avatar>
              <span className="text-foreground text-sm">{m.name}</span>
            </div>
          ))
        )}
      </aside>
    </div>
  );
}
