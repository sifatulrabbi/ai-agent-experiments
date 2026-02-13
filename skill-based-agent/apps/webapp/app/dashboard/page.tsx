import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as {session.user.email}
          </p>
          {session.user.name && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
              {session.user.name}
            </p>
          )}
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/80 px-5 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/40 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
