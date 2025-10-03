import { NextResponse } from "next/server";

interface Comment {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

export async function GET() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080"}/comments`
    );
    if (!res.ok) {
      throw new Error("Failed to fetch comments");
    }
    const comments: Comment[] = await res.json();
    return NextResponse.json(comments, { status: 200 });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, message } = body;

    if (!name?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name and message are required" },
        { status: 400 }
      );
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:8080"}/comments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, message }),
      }
    );

    if (!res.ok) {
      throw new Error("Failed to create comment");
    }

    const comment: Comment = await res.json();
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
