import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { ownerAuth } from "./owner-auth";
import { kvBucket } from "./kv-bucket";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    if (!env.BUCKET && env.FILES) (env as { BUCKET?: R2Bucket }).BUCKET = kvBucket(env.FILES);
    // Local preview keeps the mocked identity from the Vite plugin.
    if (!import.meta.env.DEV) {
      const authed = await ownerAuth(request, env as Parameters<typeof ownerAuth>[1]);
      if (authed instanceof Response) return authed;
      request = authed;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};
