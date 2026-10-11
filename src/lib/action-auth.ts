import { auth } from "@/auth";
import type { ActionFailure } from "./action-result";
import { currentGuestOwner } from "./guest-list-access";

export async function listOwnerId() {
  return (await auth())?.user?.id || (await currentGuestOwner())?.id;
}

export async function withListOwner<T>(
  operation: (userId: string) => Promise<T>,
): Promise<T | ActionFailure> {
  const id = await listOwnerId();
  return id ? operation(id) : { error: "unauthorized" };
}

export async function withAuth<T>(
  operation: (userId: string) => Promise<T>,
): Promise<T | ActionFailure> {
  const session = await auth();
  if (!session?.user?.id) return { error: "unauthorized" };
  return operation(session.user.id);
}
