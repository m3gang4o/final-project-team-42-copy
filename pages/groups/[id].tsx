import { GetServerSideProps } from "next";
import { useEffect, useRef, useState } from "react";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, Loader2Icon, Send, X } from "lucide-react";
import { SupabaseClient } from "@supabase/supabase-js";
import { Subject } from "@/server/models/auth";

interface GroupPageProps {
  group: {
    id: number;
    name: string;
    description: string | null;
  };
  user: Subject | null; 
  authorId: number | null;
}

type GroupMessage = {
  id: number;
  message: string;
  attachment_url: string | null;
  created_at: string;
  author: {
    name: string | null;
    avatar_url: string | null;
  } | null;
};

const PAGE_SIZE = 25;

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
  } else if (fileData?.path) {
    onSuccess(fileData.path);
  }
};


export default function GroupPage({ group, user, authorId }: GroupPageProps) {
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

      setMessages((data ?? []) as GroupMessage[]);
      setCursor(data ? data.length : 0);
      setHasMore((data ?? []).length === PAGE_SIZE);
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

      const newMessages = (data ?? []) as GroupMessage[];
      setMessages((prev) => [...prev, ...newMessages]);
      setCursor((prev) => prev + newMessages.length);
      if (newMessages.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    refreshMessages();
  }, [group.id]);

  const publishMessage = async () => {
    if (!draftText.trim() && !selectedFile) {
      alert("Enter a message or attach a file");
      return;
    }

    if (authorId == null) {
      alert("You must be logged in (and have a profile row) to post.");
      return;
    }

    setIsPosting(true);

    const onPostSuccess = async () => {
      setDraftText("");
      setSelectedFile(null);
      await refreshMessages();
      setIsPosting(false);
    };

    try {
      let attachmentUrl: string | null = null;

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

      await onPostSuccess();
    } catch (err) {
      console.error("Error publishing message:", err);
      alert("Failed to publish message");
      setIsPosting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const canPost = !!user && authorId != null;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="mt-2 text-muted-foreground">{group.description}</p>
        )}
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader className="pt-3 pb-3">
            <CardTitle>Shared Notes Board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-3">
            <div className="flex w-full flex-row gap-3">
              <Avatar className="mt-1">
                <AvatarImage src={undefined} />
                <AvatarFallback>
                  {group.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <Textarea
                value={draftText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setDraftText(e.target.value)
                }
                className="h-28"
                placeholder={
                  canPost
                    ? "Share a note, question, or resource with the group..."
                    : "Log in to share a note with the group..."
                }
                disabled={!canPost}
              />
            </div>
          </CardContent>
          <CardFooter className="pb-3">
            <div className="ml-auto flex flex-row gap-3">
              <Input
                className="hidden"
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSelectedFile(
                    (e.target.files ?? []).length > 0
                      ? e.target.files![0]
                      : null,
                  )
                }
                disabled={!canPost}
              />

              {selectedFile ? (
                <Button
                  variant="secondary"
                  onClick={() => setSelectedFile(null)}
                  className="flex items-center gap-2"
                  disabled={!canPost}
                >
                  <ImagePlus className="h-4 w-4" />
                  <p className="max-w-[220px] overflow-hidden text-sm text-ellipsis">
                    {selectedFile.name}
                  </p>
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!canPost}
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              )}

              <Button
                onClick={publishMessage}
                disabled={
                  !canPost ||
                  (draftText.length === 0 && !selectedFile) ||
                  isPosting
                }
              >
                {isPosting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Post
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>

        <div className="bg-card text-card-foreground rounded-xl border shadow">
          <div className="p-4">
            {loadingMessages ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2Icon className="h-6 w-6 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No messages yet. Be the first to post!
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <Card key={msg.id} className="border-none shadow-none">
                    <CardContent className="p-0 pb-2">
                      <div className="flex gap-3">
                        <Avatar className="mt-1 h-8 w-8">
                          <AvatarImage
                            src={
                              msg.author?.avatar_url
                                ? supabase.storage
                                    .from("avatars")
                                    .getPublicUrl(msg.author.avatar_url).data
                                    .publicUrl
                                : undefined
                            }
                          />
                          <AvatarFallback className="text-xs">
                            {msg.author?.name
                              ?.slice(0, 2)
                              .toUpperCase() ?? "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              {msg.author?.name ?? "Unknown"}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                          {msg.attachment_url && (
                            <div className="mt-2">
                              <img
                                src={msg.attachment_url}
                                alt="Attachment"
                                className="max-h-64 rounded-md border object-contain"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadMoreMessages}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const supabase = createSupabaseServerClient(context);
  const { id } = context.params!;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let subject: Subject | null = null;
  let authorId: number | null = null;

  if (authUser) {
    subject = { id: authUser.id } as Subject;

    if (authUser.email) {
      const { data: dbUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", authUser.email)
        .maybeSingle();

      if (dbUser?.id != null) {
        authorId = dbUser.id; 
      }
    }
  }

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !group) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      group,
      user: subject,  
      authorId,       
    },
  };
};
