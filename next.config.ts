import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server (and its HMR websocket) accept requests proxied
  // through the ngrok tunnel used for local webhook testing.
  allowedDevOrigins: ['pyromania-handler-reconvene.ngrok-free.dev'],
};

export default nextConfig;
