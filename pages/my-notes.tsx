import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { 
  FileText, Upload, File, Image as ImageIcon, X, Clock, Search, 
  Plus, Share2, Download, Trash2, MoreVertical, Grid, List,
  Folder, Star, Home, Users, Settings, Book, MessageSquare,
  Filter, SortAsc, Eye
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Document {
  id: number;
  title: string;
  message: string | null;
  group_id: number | null;
  author_id: number;
  attachment_url: string | null;
  created_at: string;
  author?: { name: string; avatar_url: string | null };
  group?: { name: string };
  file_type?: 'pdf' | 'image' | 'text' | null;
  file_size?: number;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'personal' | 'shared' | 'recent';

export default function MyNotesPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNewDocOpen, setIsNewDocOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", message: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchDocuments();
    const channel = supabase
      .channel("documents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchDocuments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*, author:users!messages_author_id_fkey(name, avatar_url), group:groups(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const formattedDocs: Document[] = (data || []).map(doc => ({
        ...doc,
        title: doc.message?.substring(0, 50) || 'Untitled Document',
        file_type: getFileType(doc.attachment_url),
      }));
      
      setDocuments(formattedDocs);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getFileType = (url: string | null): 'pdf' | 'image' | 'text' | null => {
    if (!url) return 'text';
    if (url.match(/\.pdf$/i)) return 'pdf';
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { 
      alert("File must be < 10MB"); 
      return; 
    }
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"];
    if (!validTypes.includes(file.type)) { 
      alert("Only images, PDFs, and text files allowed"); 
      return; 
    }
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

  const handleCreateDocument = async () => {
    if (!newDoc.title.trim() && !selectedFile) { 
      alert("Enter a title or select a file"); 
      return; 
    }
    setUploading(true);
    try {
      let attachmentUrl = null;
      if (selectedFile) {
        attachmentUrl = await uploadFile(selectedFile);
        if (!attachmentUrl) { 
          setUploading(false); 
          return; 
        }
      }
      const { error } = await supabase.from("messages").insert({
        message: newDoc.title || selectedFile?.name || "Untitled",
        attachment_url: attachmentUrl,
        author_id: 1, // Default user for testing
        group_id: null, // Personal document
      });
      if (error) throw error;
      setNewDoc({ title: "", message: "" });
      setSelectedFile(null);
      setFilePreview(null);
      setIsNewDocOpen(false);
      fetchDocuments();
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to create document");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const { error } = await supabase.from("messages").delete().eq("id", id);
      if (error) throw error;
      fetchDocuments();
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to delete document");
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    // Filter by type
    if (filterType === 'personal' && doc.group_id !== null) return false;
    if (filterType === 'shared' && doc.group_id === null) return false;
    if (filterType === 'recent') {
      const dayAgo = new Date();
      dayAgo.setDate(dayAgo.getDate() - 1);
      if (new Date(doc.created_at) < dayAgo) return false;
    }
    
    // Filter by search
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      doc.title?.toLowerCase().includes(query) ||
      doc.message?.toLowerCase().includes(query) ||
      doc.author?.name?.toLowerCase().includes(query)
    );
  });

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

  const getFileIcon = (fileType: 'pdf' | 'image' | 'text' | null) => {
    switch (fileType) {
      case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
      case 'image': return <ImageIcon className="h-5 w-5 text-blue-500" />;
      case 'text': return <File className="h-5 w-5 text-gray-500" />;
      default: return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Book className="h-5 w-5 text-white" />
            </div>
            {!isSidebarCollapsed && <span className="font-bold text-lg">StudyBuddy</span>}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <Home className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Dashboard</span>}
          </button>
          <button
            onClick={() => router.push("/my-notes")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
          >
            <FileText className="h-5 w-5" />
            {!isSidebarCollapsed && <span>My Documents</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Users className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Study Groups</span>}
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <MessageSquare className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Group Chat</span>}
          </button>
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300">
            <Settings className="h-5 w-5" />
            {!isSidebarCollapsed && <span>Settings</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Documents</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Organize and share your study materials</p>
            </div>
            <Button onClick={() => setIsNewDocOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)} className="flex-1 flex flex-col">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
            <TabsList className="bg-transparent">
              <TabsTrigger value="all">All Documents</TabsTrigger>
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="shared">Shared</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={filterType} className="flex-1 overflow-auto p-6 mt-0">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <FileText className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No documents found</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {searchQuery ? "Try adjusting your search" : "Create your first document to get started"}
                </p>
                {!searchQuery && (
                  <Button onClick={() => setIsNewDocOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    New Document
                  </Button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.file_type || null)}
                          <span className="font-medium text-sm truncate max-w-[150px]">{doc.title}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.attachment_url && (
                              <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </DropdownMenuItem>
                            )}
                            {doc.attachment_url && (
                              <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {doc.attachment_url && doc.file_type === 'image' && (
                        <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                          <img 
                            src={doc.attachment_url} 
                            alt={doc.title} 
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      {doc.message && doc.message !== doc.title && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                          {doc.message}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={doc.author?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {doc.author?.name?.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span>{doc.author?.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(doc.created_at)}</span>
                        </div>
                      </div>

                      {doc.group && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <Folder className="h-3 w-3" />
                          <span>{doc.group.name}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {getFileIcon(doc.file_type || null)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">{doc.title}</h3>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>{doc.author?.name || 'Unknown'}</span>
                            <span>{formatDate(doc.created_at)}</span>
                            {doc.group && <span className="text-blue-600">{doc.group.name}</span>}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.attachment_url && (
                              <>
                                <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                  <Download className="h-4 w-4 mr-2" />
                                  Download
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* New Document Dialog */}
      <Dialog open={isNewDocOpen} onOpenChange={setIsNewDocOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              Upload a file or create a text note
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Document title..."
                value={newDoc.title}
                onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Description (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a description..."
                value={newDoc.message}
                onChange={(e) => setNewDoc({ ...newDoc, message: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Attachment</Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {selectedFile ? selectedFile.name : "Choose file"}
              </Button>
              {filePreview && (
                <div className="relative mt-2">
                  <img src={filePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-6 w-6"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDocOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDocument} disabled={uploading}>
              {uploading ? "Creating..." : "Create Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
