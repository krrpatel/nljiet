// Vercel serverless entry point. The same handler is used by the local
// Node server so API behavior stays identical in development and production.
import handler from "../server.cjs";

export default handler;
