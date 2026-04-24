import { NextResponse } from "next/server";

import { auth } from "@/auth";

export default auth((req: {
  auth?: { user?: { role?: "ADMIN" | "JUDGE" | "TEAM" } } | null;
  nextUrl: { pathname: string };
  url: string;
}) => {
  const isLoggedIn = Boolean(req.auth?.user);
  const pathname = req.nextUrl.pathname;
  const role = req.auth?.user?.role;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!isLoggedIn && (pathname.startsWith("/admin") || pathname.startsWith("/judge") || pathname.startsWith("/team"))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isLoggedIn && pathname === "/login") {
    const destination = role === "ADMIN" ? "/admin" : role === "JUDGE" ? "/judge" : "/team";
    return NextResponse.redirect(new URL(destination, req.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL(role === "TEAM" ? "/team" : "/judge", req.url));
  }

  if (pathname.startsWith("/judge") && role !== "JUDGE") {
    return NextResponse.redirect(new URL(role === "TEAM" ? "/team" : "/admin", req.url));
  }

  if (pathname.startsWith("/team") && role !== "TEAM") {
    return NextResponse.redirect(new URL(role === "ADMIN" ? "/admin" : "/judge", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/export|_next/static|_next/image|favicon.ico).*)"],
};
