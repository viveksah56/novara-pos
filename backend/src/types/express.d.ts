declare global {
  namespace Express {
    interface Request {
      id: string;
      auth?: { userId: string };
    platformRole?: "SUPER_ADMIN" | "SUPPORT_AGENT";
    }
  }
}

export {};
