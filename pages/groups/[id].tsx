import { GetServerSideProps } from "next";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { MessageBoard } from "@/components/notes/MessageBoard";

interface GroupPageProps {
  group: {
    id: number;
    name: string;
    description: string;
  };
}

export default function GroupPage({ group }: GroupPageProps) {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{group.name}</h1>
        {group.description && (
          <p className="mt-2 text-muted-foreground">{group.description}</p>
        )}
      </div>

      <div className="grid gap-6">
        <div>
          <h2 className="mb-4 text-xl font-semibold">Shared Notes Board</h2>
          <MessageBoard groupId={group.id} />
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const supabase = createSupabaseServerClient(context);
  const { id } = context.params!;

  // Temporarily skip auth for testing
  // const {
  //   data: { user },
  // } = await supabase.auth.getUser();

  // if (!user) {
  //   return {
  //     redirect: {
  //       destination: "/login",
  //       permanent: false,
  //     },
  //   };
  // }

  const { data: group, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !group) {
    return {
      notFound: true,
    };
  }

  // Skip membership check for testing
  // const { data: membership } = await supabase
  //   .from("memberships")
  //   .select("*")
  //   .eq("group_id", id)
  //   .eq("user_id", user.id)
  //   .single();

  // if (!membership) {
  //   return {
  //     redirect: {
  //       destination: "/",
  //       permanent: false,
  //     },
  //   };
  // }

  return {
    props: {
      group,
    },
  };
};
