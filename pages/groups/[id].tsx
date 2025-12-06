// pages/groups/[id].tsx
import { GetServerSideProps } from "next";
import { useRouter } from "next/router";

import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { Subject } from "@/server/models/auth";
import { GroupChat, GroupChatGroup } from "@/components/group-chat";

interface GroupPageProps {
  group: GroupChatGroup & {
    owner_id: number | null;
    is_private: boolean | null;
    join_code: string | null;
    created_at: string;
  };
  user: Subject | null;
  authorId: number | null;
}

export default function GroupPage({ group, user, authorId }: GroupPageProps) {
  const router = useRouter();

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard")}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        <h1 className="text-3xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="mt-2 text-muted-foreground">{group.description}</p>
        )}
      </div>

      <GroupChat group={group} user={user} authorId={authorId} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const supabase = createSupabaseServerClient(context);
  const { id } = context.params!;

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let subject: Subject | null = null;
  let authorId: number | null = null;

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
  }

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", Number(id))
    .maybeSingle();

  if (error || !group) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      group,
      user: subject,
      authorId,
    },
  };
};
