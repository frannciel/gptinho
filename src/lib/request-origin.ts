// Match the browser's public Host, not the bind address of the Next.js server.
export function hasSameOrigin(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    const internal = new URL(request.url);
    const host = request.headers.get("host") ?? internal.host;
    const protocol =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ??
      internal.protocol.slice(0, -1);
    if (protocol !== "http" && protocol !== "https") return false;
    return (
      new URL(origin).origin === origin &&
      origin === new URL(`${protocol}://${host}`).origin
    );
  } catch {
    return false;
  }
}
