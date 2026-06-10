import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface User {
    orgId: string;
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      orgId: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    orgId?: string;
    role?: string;
  }
}
