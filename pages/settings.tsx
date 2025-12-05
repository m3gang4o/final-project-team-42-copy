import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { Book, Home, Users, Sparkles, MessageSquare, FileText, Settings, Upload, LogOut, User, Mail, Save, X, PanelLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

  const fetchUserData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        const dbUserId = user?.id ? parseInt(user.id.substring(0, 8), 16) : null;
        setUserId(dbUserId);

        if (dbUserId) {
          // Fetch user data from database
          const { data: dbUser, error: dbError } = await supabase
            .from("users")
            .select("name, avatar_url")
            .eq("id", dbUserId)
            .single();

          if (!dbError && dbUser) {
            setUserName(dbUser.name || user.user_metadata?.name || user.email?.split('@')[0] || "User");
            // If avatar_url is stored as a path, convert it to a full URL
            if (dbUser.avatar_url) {
              if (dbUser.avatar_url.startsWith('http')) {
                // Already a full URL
                setAvatarUrl(dbUser.avatar_url);
              } else {
                // It's a path, get the public URL from group-files bucket
                const { data: { publicUrl } } = supabase.storage
                  .from("group-files")
                  .getPublicUrl(dbUser.avatar_url);
                setAvatarUrl(publicUrl);
              }
            } else {
              setAvatarUrl(null);
            }
          } else {
            setUserName(user.user_metadata?.name || user.email?.split('@')[0] || "User");
            setAvatarUrl(null);
          }
        }
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
      const fileExt = file.name.split('.').pop();
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
          cacheControl: '3600',
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
      const { data: { publicUrl } } = supabase.storage
        .from("group-files")
        .getPublicUrl(uploadData.path);

      console.log("Avatar uploaded successfully:", { path: uploadData.path, publicUrl });
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
      const { error: updateError } = await supabase
        .from("users")
        .update({
          name: userName,
          avatar_url: newAvatarUrl,
        })
        .eq("id", userId);

      if (updateError) throw updateError;

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
      setError(error instanceof Error ? error.message : "Failed to save profile");
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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
                  {!isSidebarCollapsed && (
                    <span className="text-xl font-bold text-foreground whitespace-nowrap">StudyBuddy</span>
                  )}
                </div>
              </div>

              {/* Menu */}
              <nav className="p-4 space-y-6">
                <div>
                  {!isSidebarCollapsed && (
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Menu
                    </h3>
                  )}
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
                        title="Study Groups"
                      >
                        <Users className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Study Groups</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/ai-assistant")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                        title="AI Assistant"
                      >
                        <Sparkles className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>AI Assistant</span>}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => router.push("/group-chat")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-foreground hover:bg-accent transition-colors"
                        title="Group Chat"
                      >
                        <MessageSquare className="h-5 w-5 flex-shrink-0" />
                        {!isSidebarCollapsed && <span>Group Chat</span>}
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

                {/* Account */}
                <div>
                  {!isSidebarCollapsed && (
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Account
                    </h3>
                  )}
                  <ul className="space-y-1">
                    <li>
                      <button
                        onClick={() => router.push("/settings")}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-accent text-foreground font-medium"
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

            <div className="mt-auto p-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage 
                    src={previewUrl || avatarUrl || undefined} 
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-muted">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </span>
                  </AvatarFallback>
                </Avatar>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
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
      <main className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${isSidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Settings
            </h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences.
            </p>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400">
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
                  <Avatar className="w-24 h-24">
                    <AvatarImage 
                      src={previewUrl || avatarUrl || undefined} 
                      className="object-cover !aspect-auto"
                    />
                    <AvatarFallback className="text-2xl bg-muted">
                      {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {avatarUrl || previewUrl ? "Change Photo" : "Upload Photo"}
                      </Button>
                      {(avatarUrl || previewUrl) && (
                        <Button
                          variant="outline"
                          onClick={handleRemoveAvatar}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
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
                  <User className="h-4 w-4 text-muted-foreground" />
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
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    value={userEmail}
                    disabled
                    className="flex-1 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving || !userName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
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
              <CardDescription>
                Manage your account actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">Sign Out</p>
                    <p className="text-sm text-muted-foreground">Sign out of your account</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
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

