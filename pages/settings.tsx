import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import {
  Book,
  Home,
  Users,
  FileText,
  Settings,
  Upload,
  LogOut,
  User,
  Mail,
  Save,
  X,
  PanelLeft,
  ChevronRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const { data: currentUser, isLoading: loadingCurrentUser } = api.users.getCurrentUser.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const updateUserMutation = api.users.updateUser.useMutation();

  const fetchUserData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const dbUserId = user?.id
          ? parseInt(user.id.substring(0, 8), 16)
          : null;
        setUserId(dbUserId);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  useEffect(() => {
  if (currentUser) {
    setUserName(currentUser.name);
    if (currentUser.avatarUrl) {
      if (currentUser.avatarUrl.startsWith("http")) {
        setAvatarUrl(currentUser.avatarUrl);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("group-files").getPublicUrl(currentUser.avatarUrl);
        setAvatarUrl(publicUrl);
      }
    } else {
      setAvatarUrl(null);
    }
  }
}, [currentUser, supabase]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError("Image size must be less than 5MB");
        return;
      }
      setSelectedFile(file);
      setError("");
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!userId) return null;

    try {
      const currentTimestamp = Date.now().toString();
      const fileExt = file.name.split(".").pop();
      const fileName = `avatar_${userId}_${currentTimestamp}.${fileExt}`;

      // Convert file to ArrayBuffer to ensure raw binary data is uploaded without any processing
      // This prevents any automatic compression or image transformation
      const arrayBuffer = await file.arrayBuffer();

      // Upload original file as raw binary data - NO compression or modification
      // Using "group-files" bucket which is already set up in the project
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("group-files")
        .upload(`avatars/${fileName}`, arrayBuffer, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
          // Uploading as ArrayBuffer ensures no image processing occurs
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      if (!uploadData?.path) {
        throw new Error("Upload succeeded but no path returned");
      }

      // Get public URL using the actual path from upload response
      const {
        data: { publicUrl },
      } = supabase.storage.from("group-files").getPublicUrl(uploadData.path);

      console.log("Avatar uploaded successfully:", {
        path: uploadData.path,
        publicUrl,
      });
      return publicUrl;
    } catch (error) {
      console.error("Error uploading avatar:", error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!userId) {
      setError("User ID not found");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      let newAvatarUrl = avatarUrl;

      // Upload new avatar if file is selected
      if (selectedFile) {
        newAvatarUrl = await uploadAvatar(selectedFile);
        if (!newAvatarUrl) {
          throw new Error("Failed to upload avatar");
        }
      }

      // Update user in database
      await updateUserMutation.mutateAsync({
        name: userName,
        avatarUrl: newAvatarUrl,
      });

      // Update auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: userName,
          avatar_url: newAvatarUrl,
        },
      });

      if (authError) {
        console.error("Error updating auth metadata:", authError);
      }

      setAvatarUrl(newAvatarUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccess("Profile updated successfully!");
      console.log("Profile saved with avatar URL:", newAvatarUrl);

      setTimeout(() => setSuccess(""), 3000);
    } catch (error: unknown) {
      console.error("Error saving profile:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save profile",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/login");
    } catch (error) {
      console.error("Error logging out:", error);
      setError("Failed to log out");
    }
  };

  const handleRemoveAvatar = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setAvatarUrl(null);
  };

  if (loading || loadingCurrentUser) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-screen">
      {/* Sidebar */}
      <aside className="fixed top-0 left-0 z-50 flex h-screen flex-col transition-all duration-300">
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
                title={
                  isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
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

          <CollapsibleContent className="flex h-full flex-1 flex-col">
            <div>
              {/* Logo */}
              <div className="border-border border-b p-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-[#4B9CD3]">
                    <Book className="h-5 w-5 text-white" />
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="text-foreground text-xl font-bold whitespace-nowrap">
                      StudyBuddy
                    </span>
                  )}
                </div>
              </div>

              {/* Menu */}
              <nav className="space-y-6 p-4">
                <div>
                  {!isSidebarCollapsed && (
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Menu
                    </h3>
                  )}
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/dashboard")}
                        className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                        title="Dashboard"
                      >
                        <Home className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Dashboard</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/study-groups")}
                        className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                        title="Study Groups"
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Study Groups</span>}
                      </button>
                    </li>

                    <li>
                      <button
                        onClick={() => router.push("/my-notes")}
                        className="text-foreground hover:bg-accent flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
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
                  {!isSidebarCollapsed && (
                    <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                      Account
                    </h3>
                  )}
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/settings")}
                        className="bg-accent text-foreground flex w-full items-center gap-3 rounded-lg px-3 py-2 font-medium"
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

            <div className="border-border mt-auto border-t p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage
                    src={previewUrl || avatarUrl || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
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
                {!isSidebarCollapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-sm font-medium">
                      {userName}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {userEmail}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isSidebarCollapsed ? "ml-16" : "ml-64"}`}
      >
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-foreground mb-2 text-3xl font-bold">
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-destructive/10 border-destructive/20 text-destructive mb-6 rounded-lg border p-4">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Profile Settings */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your profile information and avatar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Picture */}
              <div className="space-y-4">
                <Label>Profile Picture</Label>
                <div className="flex items-center gap-6">
                  <Avatar className="h-24 w-24">
                    <AvatarImage
                      src={previewUrl || avatarUrl || undefined}
                      className="!aspect-auto object-cover"
                    />
                    <AvatarFallback className="bg-muted text-2xl">
                      {userName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {avatarUrl || previewUrl
                          ? "Change Photo"
                          : "Upload Photo"}
                      </Button>
                      {(avatarUrl || previewUrl) && (
                        <Button variant="outline" onClick={handleRemoveAvatar}>
                          <X className="mr-2 h-4 w-4" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      JPG, PNG or GIF. Max size 5MB.
                    </p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-2">
                  <User className="text-muted-foreground h-4 w-4" />
                  <Input
                    id="username"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Enter your username"
                    className="flex-1"
                  />
                </div>
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Mail className="text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    value={userEmail}
                    disabled
                    className="bg-muted flex-1"
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  Email cannot be changed
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving || !userName.trim()}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {saving ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-border flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="text-foreground font-medium">Sign Out</p>
                    <p className="text-muted-foreground text-sm">
                      Sign out of your account
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
