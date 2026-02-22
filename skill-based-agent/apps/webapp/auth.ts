import NextAuth from "next-auth";
import WorkOS from "next-auth/providers/workos";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    WorkOS({
      clientId: process.env.WORKOS_CLIENT_ID,
      clientSecret:
        process.env.WORKOS_CLIENT_SECRET ?? process.env.WORKOS_API_KEY,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user;
    },
    redirect({ url, baseUrl }) {
      // Keep relative redirects on the active request origin instead of
      // falling back to localhost in proxied environments.
      if (url.startsWith("/")) {
        return new URL(url, baseUrl).toString();
      }

      const targetUrl = new URL(url);
      if (targetUrl.origin === baseUrl) {
        return url;
      }

      return baseUrl;
    },
  },
});
