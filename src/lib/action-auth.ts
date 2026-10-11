import { auth } from "@/auth";
import type { ActionFailure } from "./action-result";

export async function withAuth<T>(
  operation: (userId: string) => Promise<T>,
): Promise<T | ActionFailure> {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  return operation(session.user.id);
}
