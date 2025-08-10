"use server";

import { revalidatePath } from "next/cache";
import { getSharedUnansweredStore } from "@/lib/unanswered-store";

export async function resolveQuestion(id: string, formData: FormData): Promise<void> {
  const note = String(formData.get("note") ?? "").trim();
  await getSharedUnansweredStore().resolve(id, note || undefined);
  revalidatePath("/admin");
}

export async function dismissQuestion(id: string, _formData: FormData): Promise<void> {
  await getSharedUnansweredStore().dismiss(id);
  revalidatePath("/admin");
}
