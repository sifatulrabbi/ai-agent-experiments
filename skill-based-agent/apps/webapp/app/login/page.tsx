import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-sm space-y-8 px-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to continue to your account
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn(
              "workos",
              { redirectTo: "/dashboard" },
              { provider: "GoogleOAuth" },
            );
          }}
        >
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </div>
  );
}
