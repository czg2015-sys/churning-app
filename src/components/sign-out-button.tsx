"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return <button className="button ghost" type="button" onClick={async () => { await createClient().auth.signOut(); router.push("/"); router.refresh(); }}><LogOut size={16} /> Sign out</button>;
}
