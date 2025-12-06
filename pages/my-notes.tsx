import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { 
  FileText, Upload, File, Image as ImageIcon, X, Clock, Search, 
  Plus, Share2, Download, Trash2, MoreVertical, Grid, List,
  Folder, Star, Home, Users, Settings, Book, MessageSquare,
  Filter, SortAsc, Eye, Sparkles, ChevronRight, PanelLeft
} from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
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
import AIStudyHelper from "@/components/ai/AIStudyHelper";
import { ModeToggle } from "@/components/theme/mode-toggle";

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

interface Group {
  id: number;
  name: string;
  description: string | null;
}

type ViewMode = 'grid' | 'list';
type FilterType = 'all' | 'personal' | 'shared' | 'recent';

export default function MyNotesPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

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
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [documentToShare, setDocumentToShare] = useState<Document | null>(null);
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [isViewContentOpen, setIsViewContentOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchUserGroups();
    const channel = supabase
      .channel("documents-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchDocuments())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      fetchDocuments();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDocuments();
      }
    };

    const handleFocus = () => {
      fetchDocuments();
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router]);

  const fetchDocuments = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error("No user logged in");
        setLoading(false);
        return;
      }
      
      // Convert Supabase UUID to integer ID for database lookup
      const userId = parseInt(user.id.substring(0, 8), 16);
      
      // Fetch user profile data
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("name, email, avatar_url")
        .eq("id", userId)
        .single();
      
      if (!userError && userData) {
        setUserName(userData.name || "");
        setUserEmail(userData.email || "");
        // Handle avatar URL - check if it's a full URL or a path
        if (userData.avatar_url) {
          if (userData.avatar_url.startsWith('http')) {
            // Already a full URL
            setUserAvatarUrl(userData.avatar_url);
          } else {
            // It's a path, get the public URL from group-files bucket
            const { data: { publicUrl } } = supabase.storage
              .from("group-files")
              .getPublicUrl(userData.avatar_url);
            setUserAvatarUrl(publicUrl);
          }
        } else {
          setUserAvatarUrl(null);
        }
      }
      
      // Fetch personal notes (group_id is null) for the current user
      const { data: personalNotes, error: personalError } = await supabase
        .from("messages")
        .select("*, author:users!messages_author_id_fkey(name, avatar_url), group:groups(name)")
        .eq("author_id", userId)
        .is("group_id", null)
        .order("created_at", { ascending: false });
      
      if (personalError) throw personalError;
      
      // Fetch groups where user is a member
      const { data: memberships, error: membershipError } = await supabase
        .from("memberships")
        .select("group_id")
        .eq("user_id", userId);
      
      if (membershipError) throw membershipError;
      
      const userGroupIds = (memberships || []).map((m: any) => m.group_id);
      
      // Fetch group notes from user's groups
      let groupNotes: any[] = [];
      if (userGroupIds.length > 0) {
        const { data: groupData, error: groupError } = await supabase
          .from("messages")
          .select("*, author:users!messages_author_id_fkey(name, avatar_url), group:groups(name)")
          .in("group_id", userGroupIds)
          .not("group_id", "is", null)
          .order("created_at", { ascending: false });
        
        if (groupError) throw groupError;
        groupNotes = groupData || [];
      }
      
      // Combine personal and group notes
      const allNotes = [...(personalNotes || []), ...groupNotes];
      
      const formattedDocs: Document[] = allNotes.map((doc: any) => ({
        ...doc,
        title: doc.message?.substring(0, 50) || 'Untitled Document',
        file_type: getFileType(doc.attachment_url),
      }));
      
      // Sort by created_at descending
      formattedDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
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
        reader.onloadend = () => {
          const result = reader.result as string;
          // Send the full data URL (includes the base64 prefix)
          resolve(result);
        };
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: base64, fileName, contentType: file.type }),
      });
      
      if (!response.ok) {
        // Clone the response so we can read it multiple times if needed
        const responseClone = response.clone();
        let errorMessage = "Upload failed";
        try {
          const errorData = await response.json();
          console.error("Upload failed with data:", errorData);
          errorMessage = errorData.error || errorData.message || "Upload failed";
        } catch (e) {
          try {
            const text = await responseClone.text();
            console.error("Upload failed with text:", text);
            errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
          } catch (e2) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("Upload successful:", data);
      return data.url;
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
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to create a note");
        setUploading(false);
        return;
      }
      
      // Convert Supabase UUID to integer ID for database lookup
      const userId = parseInt(user.id.substring(0, 8), 16);
      
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
        author_id: userId,
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

  const fetchUserGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const userId = parseInt(user.id.substring(0, 8), 16);
      
      // Fetch groups where user is a member
      const { data, error } = await supabase
        .from("memberships")
        .select(`
          group_id,
          groups (
            id,
            name,
            description
          )
        `)
        .eq("user_id", userId);
      
      if (error) throw error;
      
      const groups = (data || []).map((membership: any) => membership.groups).filter(Boolean);
      setUserGroups(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  const handleShareDocument = async () => {
    if (!documentToShare || !selectedGroupId) {
      alert("Please select a group to share with");
      return;
    }
    
    setSharing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to share");
        setSharing(false);
        return;
      }
      
      const userId = parseInt(user.id.substring(0, 8), 16);
      
      // Create a copy of the note in the selected group
      const { error } = await supabase.from("messages").insert({
        message: documentToShare.message,
        attachment_url: documentToShare.attachment_url,
        author_id: userId,
        group_id: selectedGroupId,
      });
      
      if (error) throw error;
      
      alert("Note shared successfully!");
      setIsShareDialogOpen(false);
      setDocumentToShare(null);
      setSelectedGroupId(null);
      fetchDocuments(); // Refresh the documents list to show the newly shared note
    } catch (error) {
      console.error("Error sharing document:", error);
      alert("Failed to share document");
    } finally {
      setSharing(false);
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
    <div className="min-h-screen flex bg-background">
      <aside className="fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50">
        <Collapsible
          open={!isSidebarCollapsed}
          onOpenChange={(open: boolean) => setIsSidebarCollapsed(!open)}
          className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} h-full bg-card border-r border-border flex flex-col`}
        >
          {/* Collapse Trigger */}
          <div className="absolute right-4 top-6 z-10">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 bg-card border border-border"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <PanelLeft className="h-4 w-4" />
                )}
                <span className="sr-only">Toggle sidebar</span>
              </Button>
            </CollapsibleTrigger>
          </div>

        <CollapsibleContent className="flex-1 flex flex-col h-full">
          <div>
            {/* Logo */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4B9CD3] rounded flex items-center justify-center flex-shrink-0">
                  <Book className="h-5 w-5 text-white" />
                </div>
                {!isSidebarCollapsed && <span className="text-xl font-bold text-foreground whitespace-nowrap">StudyBuddy</span>}
              </div>
            </div>

            {/* Menu */}
            <nav className="p-4 space-y-6">
              <div>
                <h3 className={`${isSidebarCollapsed ? 'hidden' : 'block'} text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3`}>
                  Menu
                </h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                      title="Dashboard"
                    >
                      <Home className="h-5 w-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Dashboard</span>}
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => router.push("/study-groups")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                      title="Group Chats"
                    >
                      <Users className="h-5 w-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Group Chats</span>}
                    </button>
                  </li>
                  
                  <li>
                    <button
                      onClick={() => router.push("/my-notes")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-accent text-foreground font-medium"
                      title="My Notes"
                    >
                      <FileText className="h-5 w-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>My Notes</span>}
                    </button>
                  </li>
                </ul>
              </div>

              {/* Account */}
              <div>
                <h3 className={`${isSidebarCollapsed ? 'hidden' : 'block'} text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3`}>
                  Account
                </h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => router.push("/settings")}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                      title="Settings"
                    >
                      <Settings className="h-5 w-5 flex-shrink-0" />
                      {!isSidebarCollapsed && <span>Settings</span>}
                    </button>
                  </li>
                </ul>
              </div>
            </nav>
          </div>

          {!isSidebarCollapsed && (
            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage 
                    src={userAvatarUrl || undefined} 
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'US'}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userName || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userEmail || 'user@example.com'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
        </Collapsible>
      </aside>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Documents</h1>
              <p className="text-sm text-muted-foreground">Organize and share your study materials</p>
            </div>
            <div className="flex items-center gap-2">
              <ModeToggle />
              <AIStudyHelper />
              <Button onClick={() => setIsNewDocOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
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
        <Tabs value={filterType} onValueChange={(v: string) => setFilterType(v as FilterType)} className="flex-1 flex flex-col">
          <div className="bg-card border-b border-border px-4">
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
                <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No documents found</h3>
                <p className="text-muted-foreground mb-4">
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
                  <Card key={doc.id} className="hover:shadow-lg transition-shadow cursor-pointer group bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.file_type || null)}
                          <span className="font-medium text-sm truncate max-w-[150px] text-foreground">{doc.title}</span>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setDocumentToView(doc);
                              setIsViewContentOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Content
                            </DropdownMenuItem>
                            {doc.attachment_url && (
                              <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Attachment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setDocumentToShare(doc);
                              setIsShareDialogOpen(true);
                            }}>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share to Group
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
                        <div className="mb-3 rounded-lg overflow-hidden bg-muted">
                          <img 
                            src={doc.attachment_url} 
                            alt={doc.title} 
                            className="w-full h-32 object-cover"
                          />
                        </div>
                      )}

                      {doc.message && doc.message !== doc.title && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {doc.message}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
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
                  <Card key={doc.id} className="hover:bg-accent transition-colors cursor-pointer bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          {getFileIcon(doc.file_type || null)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate text-foreground">{doc.title}</h3>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
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
                            <DropdownMenuItem onClick={() => {
                              setDocumentToView(doc);
                              setIsViewContentOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Content
                            </DropdownMenuItem>
                            {doc.attachment_url && (
                              <DropdownMenuItem onClick={() => window.open(doc.attachment_url!, '_blank')}>
                                <Download className="h-4 w-4 mr-2" />
                                Download Attachment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => {
                              setDocumentToShare(doc);
                              setIsShareDialogOpen(true);
                            }}>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share to Group
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
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDoc({ ...newDoc, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Description (optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a description..."
                value={newDoc.message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDoc({ ...newDoc, message: e.target.value })}
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

      {/* Share Document Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Share Note to Group</DialogTitle>
            <DialogDescription>
              Select a group to share this note with. The note will be copied to the group's shared notes board.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {documentToShare && (
              <div className="rounded-lg bg-muted p-3 mb-4">
                <p className="text-sm font-medium text-foreground mb-1">
                  {documentToShare.title}
                </p>
                {documentToShare.message && documentToShare.message !== documentToShare.title && (
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {documentToShare.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group">Select Group</Label>
              {userGroups.length === 0 ? (
                <p className="text-sm text-gray-500">
                  You are not a member of any groups yet. Join a group to share notes.
                </p>
              ) : (
                <select
                  id="group"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedGroupId || ""}
                  onChange={(e) => setSelectedGroupId(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Choose a group...</option>
                  {userGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsShareDialogOpen(false);
              setDocumentToShare(null);
              setSelectedGroupId(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleShareDocument} 
              disabled={sharing || !selectedGroupId || userGroups.length === 0}
            >
              {sharing ? "Sharing..." : "Share to Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Content Dialog */}
      <Dialog open={isViewContentOpen} onOpenChange={setIsViewContentOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{documentToView?.title || 'Document'}</DialogTitle>
            <DialogDescription>
              {documentToView?.author?.name && `Created by ${documentToView.author.name}`}
              {documentToView?.group?.name && ` • Shared in ${documentToView.group.name}`}
              {documentToView?.created_at && ` • ${new Date(documentToView.created_at).toLocaleString()}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {documentToView?.message && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm whitespace-pre-wrap break-words text-foreground">
                  {documentToView.message}
                </p>
              </div>
            )}
            {documentToView?.attachment_url && (
              <div className="space-y-2">
                <Label>Attachment</Label>
                {documentToView.file_type === 'image' ? (
                  <img 
                    src={documentToView.attachment_url} 
                    alt={documentToView.title}
                    className="w-full rounded-lg border"
                  />
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.open(documentToView.attachment_url!, '_blank')}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download {documentToView.file_type?.toUpperCase() || 'File'}
                  </Button>
                )}
              </div>
            )}
            {!documentToView?.message && !documentToView?.attachment_url && (
              <p className="text-sm text-gray-500 text-center py-4">
                No content available
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewContentOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
