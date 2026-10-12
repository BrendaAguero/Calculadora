import "server-only";
import { cookies } from "next/headers";
import { SIMPLE_COOKIE, isSimpleValue } from "@/lib/simple-mode";

export async function getSimpleMode() {
  return isSimpleValue((await cookies()).get(SIMPLE_COOKIE)?.value);
}
