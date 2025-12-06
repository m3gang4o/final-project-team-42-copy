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

  const [groupMembers, setGroupMembers] = useState<{ id: string; name: string; avatar_url: string | null }[]>([]);
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
      .select(`
        user_id,
        users (
          id,
          name,
          avatar_url
        )
      `)
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
        (
          m,
        ): m is { id: string; name: string; avatar_url: string | null } =>
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
    setOnlineMembers((prev) =>
      prev.includes(key) ? prev : [...prev, key],
    );
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
    onlineMembers.includes(m.id)
  );
  const inactiveMembers = groupMembers.filter(
    (m) => !onlineMembers.includes(m.id)
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
    <div className="flex flex-grow-3 flex-col h-full border rounded-lg overflow-hidden bg-white">

      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col-reverse p-4 gap-4">
          <div ref={messageEndRef} />

          {loadingMessages ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2Icon className="h-6 w-6 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No messages yet. Be the first to post!
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <Avatar className="h-9 w-9">
                  {msg.author?.avatar_url ? (
                    <AvatarImage src={msg.author.avatar_url} />
                  ) : (
                    <AvatarFallback>
                      {msg.author?.name?.charAt(0)?.toUpperCase() ??
                        String(msg.id).slice(-1)}
                    </AvatarFallback>
                  )}
                </Avatar>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{msg.author?.name}</p>
                    <span className="text-xs text-gray-500">
                      {formatTime(msg.created_at)}
                    </span>
                    {authorId != null && msg.author_id === authorId && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6"
                            onClick={() => handleDeleteMessage(msg.id)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                  </div>

                  <p className="mt-1 whitespace-pre-wrap break-words">
                    {msg.message}
                  </p>

                  {msg.attachment_url && (
                    <a
                      href={msg.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-sm text-blue-600 underline"
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
              >
                {loadingMore ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* COMPOSER BAR */}
      <div className="border-t p-4 bg-white">
        <div className="flex gap-3 items-end">
          <Textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 resize-none"
            disabled={!canPost}
          />

          <div className="flex flex-col gap-2">

            {/* Hidden file input */}
            <Input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
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
            >
              <ImagePlus className="h-4 w-4" />
            </Button>

            {/* Send button */}
            <Button
              variant="secondary"
              size="icon"
              onClick={publishMessage}
              disabled={!canPost || isPosting || (!draftText.trim() && !selectedFile)}
            >
              {isPosting ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="truncate max-w-[200px]">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
    <div className="border rounded-lg p-4 mb-4 bg-white">
  <h3 className="font-semibold mb-2">Active Members</h3>
  {activeMembers.length === 0 ? (
    <p className="text-sm text-gray-500">No active members</p>
  ) : (
    activeMembers.map((m) => (
      <div key={m.id} className="flex items-center gap-2 py-1">
        <Avatar className="h-7 w-7">
          <AvatarImage src={m.avatar_url ?? undefined} />
          <AvatarFallback>{m.name[0]}</AvatarFallback>
        </Avatar>
        <span className="text-sm">{m.name}</span>
        <span className="text-green-500 text-xs">● online</span>
      </div>
    ))
  )}

  <h3 className="font-semibold mt-4 mb-2">Offline Members</h3>
  {inactiveMembers.length === 0 ? (
    <p className="text-sm text-gray-500">Everyone is online!</p>
  ) : (
    inactiveMembers.map((m) => (
      <div key={m.id} className="flex items-center gap-2 py-1">
        <Avatar className="h-7 w-7">
          <AvatarImage src={m.avatar_url ?? undefined} />
          <AvatarFallback>{m.name[0]}</AvatarFallback>
        </Avatar>
        <span className="text-sm">{m.name}</span>
      </div>
    ))
  )}
</div>

    </div>
  );
}
