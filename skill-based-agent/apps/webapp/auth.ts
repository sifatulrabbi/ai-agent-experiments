import NextAuth from "next-auth";
import WorkOS from "next-auth/providers/workos";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
  },
});
