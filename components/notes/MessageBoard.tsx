"use client";

import { useEffect, useState, useRef } from "react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Send, File, Image as ImageIcon, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/utils/trpc/api";

interface Message {
  id: number;
  message: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
  author: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
}

interface MessageBoardProps {
  groupId: number;
}

export function MessageBoard({ groupId }: MessageBoardProps) {
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseComponentClient();

  const { data: messages = [], refetch } = api.messages.getMessages.useQuery({
    groupId,
  });

  const sendMessageMutation = api.messages.sendMessage.useMutation({
    onSuccess: () => {
      refetch();
      setNewMessage("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

  useEffect(() => {
    subscribeToMessages();
  }, [groupId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          refetch();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert("File size must be less than 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file: reader.result,
              fileName: file.name,
              groupId,
              contentType: file.type,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            resolve(data.url);
          } else {
            resolve(null);
          }
        } catch (error) {
          console.error("Upload error:", error);
          resolve(null);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    setUploading(true);
    let attachmentUrl = null;

    if (selectedFile) {
      attachmentUrl = await uploadFile(selectedFile);
      if (!attachmentUrl) {
        alert("File upload failed");
        setUploading(false);
        return;
      }
    }

    try {
      await sendMessageMutation.mutateAsync({
        groupId,
        message: newMessage.trim() || null,
        attachmentUrl: attachmentUrl,
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    } finally {
      setUploading(false);
    }
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  };

  const isPDF = (url: string) => {
    return /\.pdf$/i.test(url);
  };

  return (
    <div className="flex h-[600px] flex-col rounded-lg border">
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={msg.author.avatarUrl || undefined} />
                <AvatarFallback>
                  {msg.author.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    {msg.author.name}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                {msg.message && (
                  <p className="mt-1 text-sm whitespace-pre-wrap">
                    {msg.message}
                  </p>
                )}
                {msg.attachmentUrl && (
                  <div className="mt-2">
                    {isImage(msg.attachmentUrl) ? (
                      <img
                        src={msg.attachmentUrl}
                        alt="Attachment"
                        className="max-w-md rounded-lg border"
                      />
                    ) : isPDF(msg.attachmentUrl) ? (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-accent flex items-center gap-2 rounded-lg border p-3"
                      >
                        <File className="h-5 w-5" />
                        <span className="text-sm">View PDF</span>
                      </a>
                    ) : (
                      <a
                        href={msg.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:bg-accent flex items-center gap-2 rounded-lg border p-3"
                      >
                        <File className="h-5 w-5" />
                        <span className="text-sm">Download File</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        {selectedFile && (
          <div className="bg-muted mb-2 flex items-center gap-2 rounded-lg border p-2">
            {selectedFile.type.startsWith("image/") ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <File className="h-4 w-4" />
            )}
            <span className="flex-1 text-sm">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = "";
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[60px]"
            disabled={uploading || sendMessageMutation.isPending}
          />
          <Button onClick={handleSend} disabled={uploading || sendMessageMutation.isPending} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
