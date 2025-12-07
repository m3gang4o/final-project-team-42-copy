import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import Head from "next/head";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  ChevronRight,
  Book,
  Users,
  Home,
  FileText,
  PanelLeft,
  Settings,
  PlusCircle,
} from "lucide-react";

import type { Subject } from "@/server/models/auth";
import { GroupChat, GroupChatGroup } from "@/components/group-chat";
import { ModeToggle } from "@/components/theme/mode-toggle";

type Group = {
  id: number;
  name: string;
  description: string | null;
  owner_id: number | null;
  is_private: boolean | null;
  join_code: string | null;
  created_at: string;
};

type GroupsPageProps = {
  user: Subject | null;
  authorId: number | null;
  userGroups: Group[];
};

export default function GroupsPage({
  user,
  authorId,
  userGroups,
}: GroupsPageProps) {
  const supabase = createSupabaseComponentClient();
  const router = useRouter();

  const [groups, setGroups] = useState<Group[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [course, setCourse] = useState("");
  const [description, setDescription] = useState("");
  const [groupImage, setGroupImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);

  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(
    userGroups.length > 0 ? userGroups[0].id : null,
  );

  const selectedGroup: Group | null =
    userGroups.find((g) => g.id === selectedGroupId) ??
    groups.find((g) => g.id === selectedGroupId) ??
    null;

  const handleSelectGroup = (group: Group) => {
    setSelectedGroupId(group.id);
  };

  const fetchUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUserName("Guest");
        setUserEmail("");
        setUserAvatarUrl(null);
        return;
      }

      // We store name & avatar in our own `users` table keyed by numeric id
      const userId = user.id ? parseInt(user.id.substring(0, 8), 16) : 1;
      setUserEmail(user.email || "");

      if (userId) {
        const { data: dbUser, error: dbError } = await supabase
          .from("users")
          .select("name, avatar_url")
          .eq("id", userId)
          .single();

        if (!dbError && dbUser) {
          const fallbackName =
            user.user_metadata?.name || user.email?.split("@")[0] || "User";

          setUserName(dbUser.name || fallbackName);

          if (dbUser.avatar_url) {
            if (dbUser.avatar_url.startsWith("http")) {
              setUserAvatarUrl(dbUser.avatar_url);
            } else {
              const {
                data: { publicUrl },
              } = supabase.storage
                .from("group-files")
                .getPublicUrl(dbUser.avatar_url);
              setUserAvatarUrl(publicUrl);
            }
          } else {
            setUserAvatarUrl(null);
          }
        } else {
          const name =
            user.user_metadata?.name || user.email?.split("@")[0] || "User";
          setUserName(name);
          setUserAvatarUrl(null);
        }
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  // initial load + keep user info fresh on route/visibility/focus
  useEffect(() => {
    fetchUser();

    const handleRouteChange = () => {
      fetchUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchUser();
      }
    };

    const handleFocus = () => {
      fetchUser();
    };

    router.events.on("routeChangeComplete", handleRouteChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [router, supabase]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGroups((data ?? []) as Group[]);
    } catch (err) {
      console.error("Error loading groups:", err);
    }
  };

  useEffect(() => {
    fetchGroups();

    // realtime updates when new groups are created
    const channel = supabase
      .channel("groups-table-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "groups" },
        (payload) => {
          const newGroup = payload.new as Group;
          setGroups((prev) => {
            const exists = prev.some((g) => g.id === newGroup.id);
            return exists ? prev : [newGroup, ...prev];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setGroupImage(file);
  };

  const handleCreateGroup = async () => {
    setErrorMessage(null);

    if (!groupName.trim() || !course.trim()) {
      setErrorMessage("Please provide both a group name and course.");
      return;
    }

    if (!authorId) {
      setErrorMessage("You must be logged in to create a group.");
      return;
    }

    setIsSubmitting(true);

    try {
      const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();

      // Note: groupImage is collected but not yet uploaded; that can be added later.
      const { data: newGroup, error: groupError } = await supabase
        .from("groups")
        .insert({
          name: `${course} - ${groupName}`,
          description,
          owner_id: authorId,
          is_private: false,
          join_code: joinCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      if (newGroup) {
        // Add creator as member
        const { error: membershipError } = await supabase
          .from("memberships")
          .insert({
            group_id: newGroup.id,
            user_id: authorId,
          });

        if (membershipError) {
          console.error("Error creating membership:", membershipError);
        }

        setGroups((prev) => [newGroup as Group, ...prev]);
        setSelectedGroupId(newGroup.id);
      }

      // reset and close dialog
      setGroupName("");
      setCourse("");
      setDescription("");
      setGroupImage(null);
      setIsCreateGroupOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinGroup = async () => {
    setErrorMessage(null);

    if (!joinCode.trim()) {
      setErrorMessage("Enter a join code.");
      return;
    }
    if (!authorId) {
      setErrorMessage("You must be logged in to join a group.");
      return;
    }

    setIsJoining(true);

    try {
      const { data: group, error: groupError } = await supabase
        .from("groups")
        .select("*")
        .eq("join_code", joinCode.trim().toUpperCase())
        .maybeSingle();

      if (groupError) throw groupError;
      if (!group) {
        setErrorMessage("No group found with that join code.");
        return;
      }

      // ensure membership exists
      const { data: existingMembership } = await supabase
        .from("memberships")
        .select("*")
        .eq("group_id", group.id)
        .eq("user_id", authorId)
        .maybeSingle();

      if (!existingMembership) {
        const { error: membershipError } = await supabase
          .from("memberships")
          .insert({
            group_id: group.id,
            user_id: authorId,
          });

        if (membershipError) {
          console.error("Error joining group:", membershipError);
        }
      }

      setGroups((prev) => {
        const exists = prev.some((g) => g.id === group.id);
        return exists ? prev : [group as Group, ...prev];
      });
      setSelectedGroupId(group.id);

      setJoinCode("");
      setIsJoinGroupOpen(false);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <>
      <Head>
        <title>Group Chats - StudyBuddy</title>
        <meta
          name="description"
          content="Join real-time discussions with your study groups. Collaborate with classmates and share resources on StudyBuddy."
        />
      </Head>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to main content
      </a>
      <div className="bg-background flex min-h-screen">
        {/* Sidebar */}
        <aside
          className="fixed top-0 left-0 z-50 flex h-screen flex-col transition-all duration-300"
          aria-label="Main navigation"
        >
          <Collapsible
            open={!isSidebarCollapsed}
            onOpenChange={(open: boolean) => setIsSidebarCollapsed(!open)}
            className={`${isSidebarCollapsed ? "w-16" : "w-64"} bg-card border-border flex h-full flex-col border-r`}
          >
            {/* Collapse Trigger */}
            <div className="absolute top-6 right-4 z-10">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-card border-border h-8 w-8 border p-0"
                  aria-label={
                    isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <PanelLeft className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span className="sr-only">
                    {isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  </span>
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="flex h-full flex-1 flex-col">
              <div>
                {/* Logo */}
                <div className="border-border border-b p-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#4B9CD3]">
                      <Book className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <h1 className="text-foreground text-xl font-bold whitespace-nowrap">
                      StudyBuddy
                    </h1>
                  </div>
                </div>

                {/* Menu */}
                <nav className="space-y-6 p-4">
                  <div>
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Menu
                    </h3>
                    <ul className="space-y-1">
                      <li>
                        <button
                          onClick={() => router.push("/dashboard")}
                          className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                          aria-label="Navigate to Dashboard"
                        >
                          <Home
                            className="h-5 w-5 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span>Dashboard</span>
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => router.push("/study-groups")}
                          className="bg-accent text-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 font-medium"
                          aria-label="Group Chats"
                          aria-current="page"
                        >
                          <Users
                            className="h-5 w-5 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span>Group Chats</span>
                        </button>
                      </li>

                      <li>
                        <button
                          onClick={() => router.push("/my-notes")}
                          className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                          aria-label="Navigate to My Notes"
                        >
                          <FileText
                            className="h-5 w-5 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span>My Notes</span>
                        </button>
                      </li>
                    </ul>
                  </div>

                  {/* Account */}
                  <div>
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Account
                    </h3>
                    <ul className="space-y-1">
                      <li>
                        <button
                          onClick={() => router.push("/settings")}
                          className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                          aria-label="Navigate to Settings"
                        >
                          <Settings
                            className="h-5 w-5 flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span>Settings</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                </nav>
              </div>

              <div className="border-border mt-auto border-t p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarImage
                      src={userAvatarUrl || undefined}
                      alt={`${userName}'s avatar`}
                      className="object-cover"
                    />
                    <AvatarFallback
                      className="bg-muted"
                      aria-label={`${userName}'s avatar`}
                    >
                      <span className="text-muted-foreground text-sm font-semibold">
                        {userName
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </span>
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {userName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {userEmail}
                    </p>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </aside>

        {/* Main content */}
        <div className="ml-16 flex-1 md:ml-64">
          <header className="border-border bg-card border-b">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div>
                <h2 className="text-foreground text-2xl font-bold">
                  Group Chats
                </h2>
                <p className="text-muted-foreground text-sm">
                  Real-time discussions with your study groups.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ModeToggle />
                {groups.length > 0 && (
                  <Select
                    value={
                      selectedGroupId ? String(selectedGroupId) : undefined
                    }
                    onValueChange={(value) => {
                      const id = Number(value);
                      const group = userGroups.find((g) => g.id === id);
                      if (group) handleSelectGroup(group);
                    }}
                  >
                    <SelectTrigger
                      className="w-56"
                      aria-label="Select a group to chat"
                    >
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {userGroups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  onClick={() => setIsCreateGroupOpen(true)}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                  aria-label="Create a new study group"
                >
                  <PlusCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                  Create Group
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsJoinGroupOpen(true)}
                  aria-label="Join an existing study group"
                >
                  Join Group
                </Button>
              </div>
            </div>
          </header>

          <main
            id="main-content"
            className="mx-auto max-w-6xl space-y-6 px-6 py-6"
          >
            {/* Active group chat */}
            <section aria-label="Group chat conversation">
              {selectedGroup ? (
                <GroupChat
                  group={selectedGroup as GroupChatGroup}
                  user={user}
                  authorId={authorId}
                />
              ) : (
                <div
                  className="border-border bg-muted text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm"
                  role="status"
                  aria-live="polite"
                >
                  <p>
                    Select a group from the dropdown above, or join/create one
                    to start chatting.
                  </p>
                </div>
              )}
            </section>
          </main>
        </div>

        {/* Create Group Dialog */}
        <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a new Study Group</DialogTitle>
              <DialogDescription>
                Set up a group for your class so classmates can collaborate.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {errorMessage && (
                <p
                  className="text-sm text-red-600"
                  role="alert"
                  aria-live="polite"
                >
                  {errorMessage}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="group-name">
                  Group name <span aria-label="required">*</span>
                </Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Study Squad"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  aria-required="true"
                  aria-invalid={
                    errorMessage && !groupName.trim() ? "true" : "false"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course">
                  Course <span aria-label="required">*</span>
                </Label>
                <Input
                  id="course"
                  placeholder="e.g., COMP 110"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  aria-required="true"
                  aria-invalid={
                    errorMessage && !course.trim() ? "true" : "false"
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the group"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  aria-label="Group description"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="group-image">Group image (optional)</Label>
                <Input
                  id="group-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  aria-label="Upload group image"
                />
                {groupImage && (
                  <p className="text-xs text-gray-500" aria-live="polite">
                    Selected: {groupImage.name}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateGroupOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateGroup}
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : "Create Group"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Join Group Dialog */}
        <Dialog open={isJoinGroupOpen} onOpenChange={setIsJoinGroupOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Join a group</DialogTitle>
              <DialogDescription>
                Enter the join code shared with you to become a member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {errorMessage && (
                <p
                  className="text-sm text-red-600"
                  role="alert"
                  aria-live="polite"
                >
                  {errorMessage}
                </p>
              )}

              <div className="space-y-2">
                <Label htmlFor="join-code">
                  Join code <span aria-label="required">*</span>
                </Label>
                <Input
                  id="join-code"
                  placeholder="e.g., ABC123"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  aria-required="true"
                  aria-invalid={
                    errorMessage && !joinCode.trim() ? "true" : "false"
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsJoinGroupOpen(false)}
                disabled={isJoining}
              >
                Cancel
              </Button>
              <Button
                onClick={handleJoinGroup}
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={!joinCode || isJoining}
              >
                {isJoining ? "Joining..." : "Join Group"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<GroupsPageProps> = async (
  context,
) => {
  const supabase = createSupabaseServerClient(context);

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let subject: Subject | null = null;
  let authorId: number | null = null;
  let userGroups: Group[] = [];

  type MembershipRow = {
    group: Group | Group[] | null;
  };

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

    if (authorId != null) {
      const { data: memberships, error: membershipsError } = await supabase
        .from("memberships")
        .select(
          `
          group:groups!memberships_group_id_fkey (
            id,
            name,
            description,
            owner_id,
            is_private,
            join_code,
            created_at
          )
        `,
        )
        .eq("user_id", authorId);

      if (!membershipsError && memberships) {
        const membershipRows = memberships as unknown as MembershipRow[];

        userGroups = membershipRows
          .map((row) => {
            if (!row.group) return null;

            const group = Array.isArray(row.group) ? row.group[0] : row.group;
            return group ?? null;
          })
          .filter((group): group is Group => group !== null);
      }
    }
  }

  return {
    props: {
      user: subject,
      authorId,
      userGroups,
    },
  };
};
