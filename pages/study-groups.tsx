import { useState, useEffect } from "react";
import { useRouter } from "next/router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModeToggle } from "@/components/theme/mode-toggle";


import {
  Book,
  ChevronRight,
  Home,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Users,
  FileText,
  Plus,
  Lock,
  Unlock,
} from "lucide-react";

export default function GroupsPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [course, setCourse] = useState("");
  const [description, setDescription] = useState("");
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [groupImagePreview, setGroupImagePreview] = useState<string | null>(null);
  
  


  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");

  type Group = {
    id: number;
    name: string;
    description: string | null;
    owner_id: number | null;
    is_private: boolean | null;
    join_code: string | null;
    created_at: string;
  };

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel("groups-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "groups" },
        () => fetchGroups()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups((data || []) as Group[]);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size must be less than 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  const handleCreateGroup = async () => {
    if (!groupName || !course || !description) return;

    try {
      // First, ensure we have a default user (for testing without auth)
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("id", 1)
        .single();

      if (!existingUser) {
        // Create default user if doesn't exist
        await supabase.from("users").insert({
          id: 1,
          name: "Test User",
          email: "test@example.com",
        });
      }

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Create the group
      const { data: newGroup, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: `${course} - ${groupName}`,
          description: description,
          owner_id: userId,
          is_private: false,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Automatically add the creator as a member
      if (newGroup) {
        const { error: membershipError } = await supabase
          .from("memberships")
          .insert({
            user_id: userId,
            group_id: newGroup.id,
          });

        if (membershipError) {
          console.error("Error adding creator as member:", membershipError);
        }
      }

      // Refresh groups list
      fetchGroups();

      setIsCreateGroupOpen(false);
      setGroupName("");
      setCourse("");
      setDescription("");
      setGroupImagePreview(null);
    } catch (error: unknown) {
      console.error("Error creating group:", error);
      alert(`Failed to create group: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) {
      alert("Please enter a group ID");
      return;
    }

    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Parse group ID from join code
      const groupId = parseInt(joinCode.trim());
      
      if (isNaN(groupId)) {
        alert("Invalid group ID. Please enter a number.");
        return;
      }

      // Check if group exists
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("id, name")
        .eq("id", groupId)
        .single();

      if (groupError || !group) {
        alert("Group not found. Please check the group ID.");
        return;
      }

      // Check if user is already a member
      const { data: existingMembership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single();

      if (existingMembership) {
        alert("You are already a member of this group!");
        setIsJoinGroupOpen(false);
        setJoinCode("");
        return;
      }

      // Add user as a member
      const { error: membershipError } = await supabase
        .from("memberships")
        .insert({
          user_id: userId,
          group_id: groupId,
        });

      if (membershipError) throw membershipError;

      alert(`Successfully joined "${group.name}"!`);
      
      // Refresh groups list
      fetchGroups();
      
      setIsJoinGroupOpen(false);
      setJoinCode("");
    } catch (error: unknown) {
      console.error("Error joining group:", error);
      alert(`Failed to join group: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const filteredGroups = groups.filter((group) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      group.name.toLowerCase().includes(q) ||
      (group.description ?? "").toLowerCase().includes(q) ||
      (group.join_code ?? "").toLowerCase().includes(q)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50">
        <Collapsible
          open={!isSidebarCollapsed}
          onOpenChange={(open: boolean) => setIsSidebarCollapsed(!open)}
          className={`${
            isSidebarCollapsed ? "w-16" : "w-64"
          } h-full bg-card border-r border-border flex flex-col`}
        >
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
              <div className="p-6 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#4B9CD3] rounded flex items-center justify-center flex-shrink-0">
                    <Book className="h-5 w-5 text-white" />
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="text-xl font-bold text-foreground whitespace-nowrap">
                      StudyBuddy
                    </span>
                  )}
                </div>
              </div>

              <nav className="p-4 space-y-6">
                <div>
                  <h3
                    className={`${
                      isSidebarCollapsed ? "hidden" : "block"
                    } text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3`}
                  >
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
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-accent text-foreground font-medium"
                        title="Group Chats"
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        <span>Group Chats</span>
                      </button>
                    </li>
                   
                    <li>
                      <button
                        onClick={() => router.push("/my-notes")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                        title="My Notes"
                      >
                        <FileText className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>My Notes</span>}
                      </button>
                    </li>
                  </ul>
                </div>

                <div>
                  <h3
                    className={`${
                      isSidebarCollapsed ? "hidden" : "block"
                    } text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3`}
                  >
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
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {userName
                        ? userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)
                        : "US"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userName || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {userEmail || "user@example.com"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </aside>

      <div
        className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? "ml-16" : "ml-64"
        }`}
      >
        <div className="bg-card border-b border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Group Chats</h1>
              <p className="text-sm text-muted-foreground">
                Find a group to join or create your own.
              </p>
            </div>
             <div className="flex gap-3">
                <ModeToggle />
                <Button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Group
                </Button>
                <Button
                  onClick={() => setIsJoinGroupOpen(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Join Group
                </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter groups by name or description..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSearchQuery(e.target.value)
                }
                className="pl-10"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No groups found
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your filter."
                  : "Create your first Group Chat to get started."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group) => (
                <Card
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="hover:shadow-lg transition-shadow cursor-pointer group bg-card border-border"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-foreground" />
                          <span className="font-medium text-sm truncate max-w-[200px] text-foreground">
                            {group.name}
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {group.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[11px] flex items-center gap-1"
                      >
                        {group.is_private ? (
                          <>
                            <Lock className="h-3 w-3" />
                            Private
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3" />
                            Public
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex flex-col">
                          <span className="mt-1">
                          Created {formatDate(group.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Group Chat</DialogTitle>
                  <DialogDescription>
                    Start a new group chat for your course
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name">Group Name</Label>
                    <Input
                      id="group-name"
                      placeholder="e.g., COMP 110 Group Chat"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="course">Course</Label>
                    <Input
                      id="course"
                      placeholder="e.g., COMP 110"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the group"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-image">Group Image (Optional)</Label>
                    <Input
                      id="group-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="cursor-pointer"
                    />
                    {groupImagePreview && (
                      <div className="mt-2">
                        <img
                          src={groupImagePreview}
                          alt="Group preview"
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                  </div>

                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateGroupOpen(false);
                      setGroupName("");
                      setCourse("");
                      setDescription("");
                      setGroupImagePreview(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!groupName || !course || !description}
                  >
                    Create Group
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
      
            {/* Join Group Overlay */}
            <Dialog open={isJoinGroupOpen} onOpenChange={setIsJoinGroupOpen}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Join a Group Chat</DialogTitle>
                  <DialogDescription>
                    Join a group chat for your course
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="join-code">Join Code</Label>
                    <Input
                      id="join-code"
                      placeholder="Enter join code"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsJoinGroupOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleJoinGroup}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={!joinCode}
                  >
                    Join Group
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
    </div>
  );
}
