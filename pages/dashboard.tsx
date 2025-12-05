import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/router";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { Book, Home, Users, Sparkles, MessageSquare, FileText, Settings, Search, Plus, Flame, TrendingUp, PanelLeft, ChevronRight, Copy, Check, Share2, Clock, Trash2, LogOut } from "lucide-react";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) {
    const mins = Math.floor(diffInSeconds / 60);
    return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  }
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years} ${years === 1 ? 'year' : 'years'} ago`;
};

interface StudyGroup {
  id: number;
  name: string;
  description: string;
  members: number;
  resources: number;
  lastActivity: Date;
  color: string;
  imageUrl: string | null;
  owner_id: number;
}

interface RecentActivity {
  id: number;
  groupId: number;
  groupName: string;
  groupColor: string;
  authorName: string;
  authorId: number;
  message: string | null;
  attachmentUrl: string | null;
  createdAt: Date;
  activityType: 'message' | 'attachment';
}

const initialStudyGroups: StudyGroup[] = [];

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [studyGroups, setStudyGroups] = useState<StudyGroup[]>(initialStudyGroups);
  const [discoverGroups, setDiscoverGroups] = useState<StudyGroup[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("my-groups");
  const [userName, setUserName] = useState("User");
  const [userEmail, setUserEmail] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [copiedGroupId, setCopiedGroupId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); 
    
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchUser();
    fetchDiscoverGroups();
    fetchRecentActivities();
    fetchTotalResources();
    calculateStudyStreak();
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      fetchUser();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUser();
      }
    };

    const handleFocus = () => {
      fetchUser();
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

  const fetchUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;
        setCurrentUserId(userId);
        setUserEmail(user.email || "");

        if (userId) {
          const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("name, avatar_url")
            .eq("id", userId)
            .single();

          if (!dbError && dbUser) {
            setUserName(dbUser.name || user.user_metadata?.name || user.email?.split('@')[0] || "User");
            if (dbUser.avatar_url) {
              if (dbUser.avatar_url.startsWith('http')) {
                setUserAvatarUrl(dbUser.avatar_url);
              } else {
                const { data: { publicUrl } } = supabase.storage
                  .from("group-files")
                  .getPublicUrl(dbUser.avatar_url);
                setUserAvatarUrl(publicUrl);
              }
            } else {
              setUserAvatarUrl(null);
            }
          } else {
            const name = user.user_metadata?.name || user.email?.split('@')[0] || "User";
            setUserName(name);
            setUserAvatarUrl(null);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      const { data, error } = await supabase
        .from("memberships")
        .select(`
          group_id,
          groups (
            id,
            name,
            description,
            owner_id,
            is_private,
            created_at
          )
        `)
        .eq("user_id", userId);
      
      if (error) throw error;
      
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (membership: any) => {
          const group = membership.groups;
          if (!group) return null;

          const { count: memberCount } = await supabase
            .from("memberships")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const { count: messageCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const { data: recentMessage } = await supabase
            .from("messages")
            .select("created_at")
            .eq("group_id", group.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let lastActivity = new Date(group.created_at);
          if (recentMessage?.created_at) {
            lastActivity = new Date(recentMessage.created_at);
          }

          return {
            id: group.id,
            name: group.name,
            description: group.description || "",
            members: memberCount || 0,
            resources: messageCount || 0,
            lastActivity: lastActivity,
            color: groupColors[group.id % groupColors.length],
            imageUrl: null,
            owner_id: group.owner_id,
          };
        })
      );

      const formattedGroups: StudyGroup[] = groupsWithCounts.filter((g) => g !== null) as StudyGroup[];
      setStudyGroups(formattedGroups);
      
      const total = formattedGroups.reduce((sum, group) => sum + group.resources, 0);
      setTotalResources(total);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoverGroups = async () => {
    try {
      setDiscoverLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      const { data: userMemberships } = await supabase
        .from("memberships")
        .select("group_id")
        .eq("user_id", userId);

      const userGroupIds = new Set((userMemberships || []).map((m: any) => m.group_id));

      const { data: allGroups, error } = await supabase
        .from("groups")
        .select("id, name, description, owner_id, is_private, created_at")
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const discoverableGroups = (allGroups || []).filter((group: any) => !userGroupIds.has(group.id)).slice(0, 20);

      const groupsWithCounts = await Promise.all(
        discoverableGroups.map(async (group: any) => {
          const { count: memberCount } = await supabase
            .from("memberships")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const { count: messageCount } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("group_id", group.id);

          const { data: recentMessage } = await supabase
            .from("messages")
            .select("created_at")
            .eq("group_id", group.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          let lastActivity = new Date(group.created_at);
          if (recentMessage?.created_at) {
            lastActivity = new Date(recentMessage.created_at);
          }

          return {
            id: group.id,
            name: group.name,
            description: group.description || "",
            members: memberCount || 0,
            resources: messageCount || 0,
            lastActivity: lastActivity,
            color: groupColors[group.id % groupColors.length],
            imageUrl: null,
            owner_id: group.owner_id,
          };
        })
      );

      setDiscoverGroups(groupsWithCounts);
    } catch (error) {
      console.error("Error fetching discover groups:", error);
    } finally {
      setDiscoverLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      setActivitiesLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      const { data: userMemberships } = await supabase
        .from("memberships")
        .select("group_id")
        .eq("user_id", userId);

      if (!userMemberships || userMemberships.length === 0) {
        setRecentActivities([]);
        return;
      }

      const userGroupIds = userMemberships.map((m: any) => m.group_id);

      const { data: messages, error } = await supabase
        .from("messages")
        .select(`
          id,
          group_id,
          author_id,
          message,
          attachment_url,
          created_at,
          groups!messages_group_id_fkey(
            id,
            name
          ),
          author:users!messages_author_id_fkey(
            id,
            name
          )
        `)
        .in("group_id", userGroupIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const activities: RecentActivity[] = (messages || []).map((msg: any) => {
        const group = Array.isArray(msg.groups) ? msg.groups[0] : msg.groups;
        const author = Array.isArray(msg.author) ? msg.author[0] : msg.author;
        const groupId = group?.id || msg.group_id;
        const activityType = msg.attachment_url ? 'attachment' : 'message';

        return {
          id: msg.id,
          groupId: groupId,
          groupName: group?.name || 'Unknown Group',
          groupColor: groupColors[groupId % groupColors.length],
          authorName: author?.name || 'Anonymous',
          authorId: author?.id || msg.author_id,
          message: msg.message,
          attachmentUrl: msg.attachment_url,
          createdAt: new Date(msg.created_at),
          activityType: activityType,
        };
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
    } finally {
      setActivitiesLoading(false);
    }
  };

  const fetchTotalResources = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Get all groups that the user is a member of
      const { data: userMemberships } = await supabase
        .from("memberships")
        .select("group_id")
        .eq("user_id", userId);

      if (!userMemberships || userMemberships.length === 0) {
        setTotalResources(0);
        return;
      }

      const userGroupIds = userMemberships.map((m: any) => m.group_id);

      // Get total message count across all user's groups
      const { count: totalMessageCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("group_id", userGroupIds);

      setTotalResources(totalMessageCount || 0);
    } catch (error) {
      console.error("Error fetching total resources:", error);
    }
  };

  const calculateStudyStreak = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Get storage key for this user's streak data
      const streakKey = `studyStreak_${userId}`;
      const lastVisitKey = `lastVisit_${userId}`;

      // Get last visit date from localStorage
      const lastVisitStr = typeof window !== 'undefined' ? localStorage.getItem(lastVisitKey) : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (!lastVisitStr) {
        // First visit
        if (typeof window !== 'undefined') {
          localStorage.setItem(lastVisitKey, today.toISOString());
          localStorage.setItem(streakKey, '1');
        }
        setStudyStreak(1);
        return;
      }

      const lastVisit = new Date(lastVisitStr);
      lastVisit.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor((today.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24));
      const currentStreak = typeof window !== 'undefined' ? parseInt(localStorage.getItem(streakKey) || '0') : 0;

      let newStreak = currentStreak;

      if (daysDiff === 0) {
        // Keep current streak
        newStreak = currentStreak;
      } else if (daysDiff === 1) {
        // Increment streak
        newStreak = currentStreak + 1;
        if (typeof window !== 'undefined') {
          localStorage.setItem(lastVisitKey, today.toISOString());
          localStorage.setItem(streakKey, newStreak.toString());
        }
      } else {
        // Streak broken
        newStreak = 1;
        if (typeof window !== 'undefined') {
          localStorage.setItem(lastVisitKey, today.toISOString());
          localStorage.setItem(streakKey, '1');
        }
      }

      setStudyStreak(newStreak);
    } catch (error) {
      console.error("Error calculating study streak:", error);
      setStudyStreak(0);
    }
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [course, setCourse] = useState("");
  const [description, setDescription] = useState("");
  const [groupImagePreview, setGroupImagePreview] = useState<string | null>(null);
  const [isJoinGroupOpen, setIsJoinGroupOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [studyStreak, setStudyStreak] = useState(0);
  const [totalResources, setTotalResources] = useState(0);
  const [joinCodeDialogOpen, setJoinCodeDialogOpen] = useState(false);
  const [selectedGroupForJoinCode, setSelectedGroupForJoinCode] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroupForDelete, setSelectedGroupForDelete] = useState<{ id: number; name: string } | null>(null);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedGroupForLeave, setSelectedGroupForLeave] = useState<{ id: number; name: string } | null>(null);

  const groupColors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-yellow-500", "bg-red-500", "bg-indigo-500"];

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
      fetchTotalResources();

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
      fetchDiscoverGroups();
      fetchRecentActivities();
      fetchTotalResources();
      
      setIsJoinGroupOpen(false);
      setJoinCode("");
    } catch (error: unknown) {
      console.error("Error joining group:", error);
      alert(`Failed to join group: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroupForDelete) return;

    try {
      const groupId = selectedGroupForDelete.id;

      // Delete all memberships for this group
      const { error: membershipError } = await supabase
        .from("memberships")
        .delete()
        .eq("group_id", groupId);

      if (membershipError) {
        console.error("Error deleting memberships:", membershipError);
        // Continue anyway - might be due to foreign key constraints
      }

      // Delete all messages for this group
      const { error: messagesError } = await supabase
        .from("messages")
        .delete()
        .eq("group_id", groupId);

      if (messagesError) {
        console.error("Error deleting messages:", messagesError);
      }

      // Delete the group itself
      const { error: groupError } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);

      if (groupError) throw groupError;

      // Refresh groups list
      fetchGroups();
      fetchDiscoverGroups();
      fetchRecentActivities();
      fetchTotalResources();

      setDeleteDialogOpen(false);
      setSelectedGroupForDelete(null);
    } catch (error: unknown) {
      console.error("Error deleting group:", error);
      alert(`Failed to delete group: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroupForLeave) return;

    try {
      const groupId = selectedGroupForLeave.id;

      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Remove the user's membership
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("user_id", userId)
        .eq("group_id", groupId);

      if (error) throw error;

      // Refresh groups list
      fetchGroups();
      fetchDiscoverGroups();
      fetchRecentActivities();
      fetchTotalResources();

      setLeaveDialogOpen(false);
      setSelectedGroupForLeave(null);
    } catch (error: unknown) {
      console.error("Error leaving group:", error);
      alert(`Failed to leave group: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const handleJoinDiscoverGroup = async (groupId: number, groupName: string) => {
    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id ? parseInt(user.id.substring(0, 8), 16) : 1;

      // Check if user is already a member
      const { data: existingMembership } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", userId)
        .eq("group_id", groupId)
        .single();

      if (existingMembership) {
        alert("You are already a member of this group!");
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

      alert(`Successfully joined "${groupName}"!`);
      
      // Refresh groups list
      fetchGroups();
      fetchDiscoverGroups();
      fetchRecentActivities();
      fetchTotalResources();
    } catch (error: unknown) {
      console.error("Error joining group:", error);
      alert(`Failed to join group: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const filteredStudyGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return studyGroups;
    }
    const query = searchQuery.toLowerCase().trim();
    return studyGroups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query)
    );
  }, [searchQuery, studyGroups]);

  const filteredDiscoverGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return discoverGroups;
    }
    const query = searchQuery.toLowerCase().trim();
    return discoverGroups.filter(
      (group) =>
        group.name.toLowerCase().includes(query) ||
        group.description.toLowerCase().includes(query)
    );
  }, [searchQuery, discoverGroups]);

  const filteredRecentActivities = useMemo(() => {
    if (!searchQuery.trim()) {
      return recentActivities;
    }
    const query = searchQuery.toLowerCase().trim();
    return recentActivities.filter(
      (activity) =>
        activity.groupName.toLowerCase().includes(query) ||
        activity.authorName.toLowerCase().includes(query) ||
        (activity.message && activity.message.toLowerCase().includes(query))
    );
  }, [searchQuery, recentActivities]);

  const getActivityDescription = (activity: RecentActivity): string => {
    const isCurrentUser = activity.authorId === currentUserId;
    const authorName = isCurrentUser ? 'You' : activity.authorName;
    
    if (activity.activityType === 'attachment') {
      const fileName = activity.attachmentUrl?.split('/').pop() || 'a file';
      return `${authorName} uploaded ${fileName}`;
    } else if (activity.message) {
      const messagePreview = activity.message.length > 50 
        ? activity.message.substring(0, 50) + '...'
        : activity.message;
      return `${authorName}: ${messagePreview}`;
    }
    return `${authorName} posted in ${activity.groupName}`;
  };

  const handleCopyJoinCode = async (groupId: number) => {
    try {
      await navigator.clipboard.writeText(groupId.toString());
      setCopiedGroupId(groupId);
      setTimeout(() => setCopiedGroupId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
      alert("Failed to copy join code. Please try again.");
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
                  <span className="text-xl font-bold text-foreground whitespace-nowrap">StudyBuddy</span>
                </div>
              </div>

              {/* Menu */}
              <nav className="p-4 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Menu
                  </h3>
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-accent text-foreground font-medium"
                        title="Dashboard"
                      >
                        <Home className="h-5 w-5 flex-shrink-0" />
                        <span>Dashboard</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/study-groups")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
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
                        <span>My Notes</span>
                      </button>
                    </li>
                  </ul>
                </div>

                {/* Account */}
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
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
                        <span>Settings</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </nav>
            </div>

            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage 
                    src={userAvatarUrl || undefined} 
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {userEmail}
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Welcome Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome, {userName}!
            </h1>
            <p className="text-muted-foreground">
              Here&apos;s what&apos;s happening with your group chats today.
            </p>
          </div>
          <ModeToggle />
        </div>

        {/* Group Chats Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Group Chats</h2>
              <p className="text-muted-foreground mt-1">
                Join course-specific groups to collaborate with classmates
              </p>
            </div>
              <div className="flex gap-3">
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
                  className="border-gray-300 text-black hover:bg-gray-100"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Join Group
                </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Total Groups
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {studyGroups.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {studyGroups.length === 0 ? 'Create your first group' : 'Across all courses'}
                    </p>
                  </div>
                  <Users className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Total Members
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {studyGroups.reduce((sum, group) => sum + group.members, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {studyGroups.length > 0 ? 'In your groups' : 'Join a group to get started'}
                    </p>
                  </div>
                  <Users className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Messages & Files
                    </p>
                    <p className="text-3xl font-bold text-foreground">
                      {totalResources}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalResources > 0 ? 'Across all your groups' : 'No messages yet'}
                    </p>
                  </div>
                  <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Study Streak
                    </p>
                    <p className="text-3xl font-bold text-foreground flex items-center gap-1">
                      {studyStreak} day{studyStreak !== 1 ? 's' : ''} {studyStreak > 0 && <Flame className="h-5 w-5 text-orange-500" />}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {studyStreak === 0 ? 'Start your streak today!' : studyStreak < 3 ? 'Keep it up!' : studyStreak < 7 ? 'Great job!' : 'Amazing streak!'}
                    </p>
                  </div>
                  <TrendingUp className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs and Search */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="my-groups">My Groups</TabsTrigger>
                <TabsTrigger value="discover">Discover</TabsTrigger>
                <TabsTrigger value="recent-activity">Recent Activity</TabsTrigger>
              </TabsList>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={
                    activeTab === "recent-activity" 
                      ? "Search activities..." 
                      : activeTab === "discover"
                      ? "Search groups..."
                      : "Search your groups..."
                  }
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* My Groups Tab */}
            <TabsContent value="my-groups" className="mt-6">
              {filteredStudyGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Create your first group chat!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredStudyGroups.map((group) => (
                <Card 
                  key={group.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/groups/${group.id}`)}
                >
                  <CardContent className="p-6 relative">
                    {currentUserId === group.owner_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroupForDelete({ id: group.id, name: group.name });
                          setDeleteDialogOpen(true);
                        }}
                        className="absolute top-2 right-2 h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <div className="flex items-start gap-4">
                      {group.imageUrl ? (
                          <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                            <img
                              src={group.imageUrl}
                              alt={group.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-12 h-12 ${group.color} rounded-lg flex items-center justify-center flex-shrink-0`}
                          >
                            <Book className="h-6 w-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-foreground mb-1">
                            {group.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {group.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{group.members} members</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FileText className="h-4 w-4" />
                              <span>{group.resources} resources</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 mt-3 mb-3">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-foreground">
                              Recent activity: {formatTimeAgo(group.lastActivity)}
                            </span>
                          </div>
                          {currentUserId === group.owner_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupForJoinCode(group.id);
                                setJoinCodeDialogOpen(true);
                              }}
                              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                              <Share2 className="h-4 w-4 mr-2" />
                              View Join Code
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupForLeave({ id: group.id, name: group.name });
                                setLeaveDialogOpen(true);
                              }}
                              className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                            >
                              <LogOut className="h-4 w-4 mr-2" />
                              Leave Group
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Discover Tab */}
            <TabsContent value="discover" className="mt-6">
              {discoverLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Loading groups...</p>
                </div>
              ) : filteredDiscoverGroups.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No groups available to discover. Create your own group to get started!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredDiscoverGroups.map((group) => (
                    <Card 
                      key={group.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => router.push(`/groups/${group.id}`)}
                    >
                      <CardContent className="p-6 relative">
                        <div className="flex items-start gap-4">
                          {group.imageUrl ? (
                            <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden border border-border">
                              <img
                                src={group.imageUrl}
                                alt={group.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-12 h-12 ${group.color} rounded-lg flex items-center justify-center flex-shrink-0`}
                            >
                              <Book className="h-6 w-6 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-foreground mb-1">
                              {group.name}
                            </h3>
                            <p className="text-sm text-muted-foreground mb-3">
                              {group.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{group.members} members</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FileText className="h-4 w-4" />
                                <span>{group.resources} resources</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-3 mb-3">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-foreground">
                                Recent activity: {formatTimeAgo(group.lastActivity)}
                              </span>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleJoinDiscoverGroup(group.id, group.name);
                              }}
                              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Join Group
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Recent Activity Tab */}
            <TabsContent value="recent-activity" className="mt-6">
              {activitiesLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Loading activities...</p>
                </div>
              ) : filteredRecentActivities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No recent activity. Join groups and start collaborating!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecentActivities.map((activity) => (
                    <Card
                      key={activity.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/groups/${activity.groupId}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-10 h-10 ${activity.groupColor} rounded-lg flex items-center justify-center flex-shrink-0`}
                          >
                            <Book className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-foreground">
                                {activity.groupName}
                              </h3>
                            </div>
                            <p className="text-sm text-foreground mb-2">
                              {getActivityDescription(activity)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimeAgo(activity.createdAt)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Create Group Overlay */}
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
                    className="w-24 h-24 object-cover rounded-lg border border-border"
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

      {/* Join Code Overlay */}
      <Dialog open={joinCodeDialogOpen} onOpenChange={setJoinCodeDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Join Code</DialogTitle>
            <DialogDescription>
              Share this code with others so they can join your study group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedGroupForJoinCode && (
              <div className="space-y-3">
                <div className="p-6 bg-blue-50 border-2 border-blue-200 rounded-lg text-center">
                  <p className="text-sm font-medium text-blue-900 mb-2">
                    Your Join Code
                  </p>
                  <p className="text-4xl font-bold text-blue-700 font-mono tracking-wider">
                    {selectedGroupForJoinCode}
                  </p>
                </div>
                <Button
                  onClick={() => selectedGroupForJoinCode && handleCopyJoinCode(selectedGroupForJoinCode)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {copiedGroupId === selectedGroupForJoinCode ? (
                    <>
                      <Check className="h-5 w-5 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-5 w-5 mr-2" />
                      Copy Join Code
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Anyone with this code can join your group by entering it in the &quot;Join Group&quot; section
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setJoinCodeDialogOpen(false);
                setSelectedGroupForJoinCode(null);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Confirmation Overlay */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Delete Study Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this study group? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedGroupForDelete && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900 mb-1">
                  Group to be deleted:
                </p>
                <p className="text-base font-semibold text-red-700">
                  {selectedGroupForDelete.name}
                </p>
                <p className="text-xs text-red-600 mt-2">
                  This will permanently delete the group, all memberships, and all messages.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedGroupForDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteGroup}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Group Confirmation Overlay */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Leave Study Group</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this study group? You can rejoin later using the join code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedGroupForLeave && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm font-medium text-orange-900 mb-1">
                  Group you&apos;ll be leaving:
                </p>
                <p className="text-base font-semibold text-orange-700">
                  {selectedGroupForLeave.name}
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  You will no longer have access to this group&apos;s messages and resources.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setLeaveDialogOpen(false);
                setSelectedGroupForLeave(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeaveGroup}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
