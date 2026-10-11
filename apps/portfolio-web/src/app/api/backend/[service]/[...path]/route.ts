import { auth } from "@clerk/nextjs/server";
import { readConfig } from "@/shared/config/config";
import { proxyRequest } from "@/shared/api/proxy";
type Context = { params: Promise<{ service: string; path: string[] }> };
async function handle(request: Request, context: Context) {
  const { service, path } = await context.params;
  return proxyRequest(
    request,
    service,
    path,
    readConfig(process.env),
    async () => {
      const session = await auth();
      return session.userId ? session.getToken({ template: "capiro" }) : null;
    },
  );
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
