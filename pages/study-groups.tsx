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


import {
  Book,
  ChevronRight,
  Home,
  PanelLeft,
  Search,
  Settings,
  Sparkles,
  Users,
  MessageSquare,
  FileText,
  Plus,
  Lock,
  Unlock,
} from "lucide-react";

export default function StudyGroupsPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();

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
    <div className="min-h-screen flex bg-gray-50">
      <aside className="fixed left-0 top-0 h-screen flex flex-col transition-all duration-300 z-50">
        <Collapsible
          open={!isSidebarCollapsed}
          onOpenChange={(open: boolean) => setIsSidebarCollapsed(!open)}
          className={`${
            isSidebarCollapsed ? "w-16" : "w-64"
          } h-full bg-white border-r border-gray-200 flex flex-col`}
        >
          <div className="absolute right-4 top-6 z-10">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 bg-white border border-gray-200"
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
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#4B9CD3] rounded flex items-center justify-center flex-shrink-0">
                    <Book className="h-5 w-5 text-white" />
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="text-xl font-bold text-[#13294B] whitespace-nowrap">
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
                    } text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3`}
                  >
                    Menu
                  </h3>
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Dashboard"
                      >
                        <Home className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Dashboard</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/study-groups")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 text-gray-900 font-medium"
                        title="Study Groups"
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Study Groups</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/ai-assistant")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        title="AI Assistant"
                      >
                        <Sparkles className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>AI Assistant</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/group-chat")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                        title="Group Chat"
                      >
                        <MessageSquare className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Group Chat</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/my-notes")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
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
                    } text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3`}
                  >
                    Account
                  </h3>
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/settings")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
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
              <div className="mt-auto p-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-700">
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
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {userName || "User"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
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
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Study Groups</h1>
              <p className="text-sm text-gray-600">
                Find a group to join or create your own.
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                console.log("Join / Create clicked"); //IMPLEMENT ROUTER
              }}
            >
              <Plus className="h-4 w-4" />
              Join / Create
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
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
              <Users className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No groups found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery
                  ? "Try adjusting your filter."
                  : "Create your first study group to get started."}
              </p>
              {!searchQuery && (
                <Button
                  className="gap-2"
                  onClick={() => console.log("Create Group")}//IMPLEMENT CREATEGROUP
                >
                  <Plus className="h-4 w-4" />
                  Create Group
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group) => (
                <Card
                  key={group.id}
                  onClick={() => router.push(`/groups/${group.id}`)}
                  className="hover:shadow-lg transition-shadow cursor-pointer group"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-700" />
                          <span className="font-medium text-sm truncate max-w-[200px]">
                            {group.name}
                          </span>
                        </div>
                        {group.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">
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

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex flex-col">
                          <span className="mt-1">
                          Created {formatDate(group.created_at)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.stopPropagation();
                          console.log("Join group", group.id);//IMPLEMENT JOIN GROUP
                        }}
                      >
                        Join
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
