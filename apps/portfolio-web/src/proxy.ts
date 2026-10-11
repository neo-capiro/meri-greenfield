import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { readConfig } from "./shared/config/config";
const clerk = clerkMiddleware();
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!readConfig(process.env).authConfigured) return NextResponse.next();
  return clerk(request, event);
}
export const config = {
  matcher: ["/((?!_next|healthz|.*\\..*).*)", "/api/(.*)"],
};
