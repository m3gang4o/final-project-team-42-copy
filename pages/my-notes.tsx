import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { Book, FileText, Upload, File, Image as ImageIcon, X, Clock, Search, Plus, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";

interface Note {
  id: number;
  message: string | null;
  group_id: number | null;
  author_id: number;
  attachment_url: string | null;
  created_at: string;
  author?: { name: string };
  group?: { name: string };
}

export default function MyNotesPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newNote, setNewNote] = useState({ message: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
    const channel = supabase
      .channel("notes-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchNotes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*, author:users!messages_author_id_fkey(name), group:groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("File must be < 10MB"); return; }
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) { alert("Only images and PDFs allowed"); return; }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, fileName, contentType: file.type }),
      });
      if (!response.ok) throw new Error("Upload failed");
      const { url } = await response.json();
      return url;
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file");
      return null;
    }
  };

  const handleCreateNote = async () => {
    if (!newNote.message.trim() && !selectedFile) { alert("Enter message or select file"); return; }
    setUploading(true);
    try {
      let attachmentUrl = null;
      if (selectedFile) {
        attachmentUrl = await uploadFile(selectedFile);
        if (!attachmentUrl) { setUploading(false); return; }
      }
      const { error } = await supabase.from("messages").insert({
        message: newNote.message || null,
        attachment_url: attachmentUrl,
        author_id: 1, // Default user for testing
        group_id: null,
      });
      if (error) throw error;
      setNewNote({ message: "" });
      setSelectedFile(null);
      setFilePreview(null);
      setIsNewNoteOpen(false);
      fetchNotes();
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create note");
    } finally {
      setUploading(false);
    }
  };

  const filteredNotes = notes.filter((note) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return note.message?.toLowerCase().includes(query) || note.author?.name?.toLowerCase().includes(query);
  });

  const getFileType = (url: string | null): "image" | "pdf" | null => {
    if (!url) return null;
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return "image";
    if (url.match(/\.pdf$/i)) return "pdf";
    return null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
      <aside className="w-64 h-screen fixed left-0 top-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Book className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold">StudyBuddy</span>
          </div>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            <li><button onClick={() => router.push("/dashboard")} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"><Book className="h-5 w-5" /><span>Dashboard</span></button></li>
            <li><button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-blue-600 font-medium"><FileText className="h-5 w-5" /><span>My Notes</span></button></li>
          </ul>
        </nav>
      </aside>

      <main className="flex-1 ml-64 p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">My Notes</h1>
            <Button onClick={() => setIsNewNoteOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4 mr-2" />New Note
            </Button>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Organize and share your study notes</p>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-600 mb-2">Total Notes</p><p className="text-3xl font-bold">{notes.length}</p></div><FileText className="h-6 w-6 text-gray-400" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-600 mb-2">With Files</p><p className="text-3xl font-bold">{notes.filter((n) => n.attachment_url).length}</p></div><Upload className="h-6 w-6 text-gray-400" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-600 mb-2">Shared</p><p className="text-3xl font-bold">{notes.filter((n) => n.group_id).length}</p></div><Share2 className="h-6 w-6 text-gray-400" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-gray-600 mb-2">Recent</p><p className="text-3xl font-bold">{notes.filter((n) => new Date(n.created_at) > new Date(Date.now() - 86400000)).length}</p></div><Clock className="h-6 w-6 text-gray-400" /></div></CardContent></Card>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input type="text" placeholder="Search notes..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500"><FileText className="h-12 w-12 mx-auto mb-4 opacity-50" /><p className="text-lg font-medium mb-2">No notes yet</p><p className="text-sm">Create your first note!</p></div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => {
              const fileType = getFileType(note.attachment_url);
              return (
                <Card key={note.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {note.attachment_url && (
                        <div className="flex-shrink-0">
                          {fileType === "image" ? (
                            <img src={note.attachment_url} alt="Attachment" className="w-24 h-24 object-cover rounded-lg border" />
                          ) : fileType === "pdf" ? (
                            <div className="w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-lg border border-red-200 flex items-center justify-center">
                              <File className="h-8 w-8 text-red-600" />
                            </div>
                          ) : null}
                        </div>
                      )}
                      <div className="flex-1">
                        {note.message && <p className="text-gray-900 dark:text-white mb-3 whitespace-pre-wrap">{note.message}</p>}
                        {note.attachment_url && (
                          <a href={note.attachment_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 mb-3">
                            {fileType === "image" ? <><ImageIcon className="h-4 w-4" />View Image</> : <><File className="h-4 w-4" />Download PDF</>}
                          </a>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {note.author && <span>{note.author.name}</span>}
                          {note.group && <div className="flex items-center gap-1"><Share2 className="h-3 w-3" /><span>{note.group.name}</span></div>}
                          <div className="flex items-center gap-1"><Clock className="h-3 w-3" /><span>{formatDate(note.created_at)}</span></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={isNewNoteOpen} onOpenChange={setIsNewNoteOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription>Add a new study note with optional file attachment</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="Write your notes..." className="min-h-[150px]" value={newNote.message} onChange={(e) => setNewNote({ message: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Attachment (Optional)</Label>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileSelect} className="hidden" />
              {selectedFile ? (
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {selectedFile.type.startsWith("image/") ? <ImageIcon className="h-5 w-5 text-blue-600" /> : <File className="h-5 w-5 text-red-600" />}
                      <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedFile(null); setFilePreview(null); }}><X className="h-4 w-4" /></Button>
                  </div>
                  {filePreview && <img src={filePreview} alt="Preview" className="w-full h-32 object-cover rounded" />}
                </div>
              ) : (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full"><Upload className="h-4 w-4 mr-2" />Upload Image or PDF</Button>
              )}
              <p className="text-xs text-gray-500">Max 10MB. Supported: Images (JPEG, PNG, GIF, WebP) and PDFs</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewNoteOpen(false)} disabled={uploading}>Cancel</Button>
            <Button onClick={handleCreateNote} className="bg-blue-600 hover:bg-blue-700 text-white" disabled={uploading || (!newNote.message.trim() && !selectedFile)}>
              {uploading ? "Creating..." : "Create Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
