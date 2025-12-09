"use client";

import type React from "react";

import { useState, useEffect } from "react";

interface Reply {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

interface Comment {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  reactions: Record<string, number>;
  replies: Reply[];
}

export default function PONHatePage() {
  const [rotation, setRotation] = useState(0);
  const [glitchText, setGlitchText] = useState("PON");
  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setRotation((prev) => prev + 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      const glitches = ["P0N", "POИ", "P◊N", "PON", "P⊗N", "PØN"];
      setGlitchText(glitches[Math.floor(Math.random() * glitches.length)]);
    }, 200);
    return () => clearInterval(glitchInterval);
  }, []);

  useEffect(() => {
    fetchComments();
  }, []);

  const fetchComments = async () => {
    try {
      const response = await fetch("/api/comments");
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Failed to fetch comments:", error);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          message: message.trim(),
        }),
      });

      if (response.ok) {
        const newComment = await response.json();
        setComments([newComment, ...comments]);
        setName("");
        setMessage("");
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = async (commentId: string, emoji: string) => {
    try {
      setComments((prevComments) =>
        prevComments.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                reactions: {
                  ...comment.reactions,
                  [emoji]: (comment.reactions[emoji] || 0) + 1,
                },
              }
            : comment
        )
      );

      const response = await fetch("/api/reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "reaction",
          commentId,
          emoji,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add reaction");
      }
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  };

  const handleReply = async (commentId: string) => {
    if (!name.trim() || !message.trim()) return;

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parentId: commentId,
          name: name.trim(),
          message: message.trim(),
        }),
      });

      if (response.ok) {
        const addedReply = await response.json();
        setComments(
          comments.map((c) =>
            c.id === commentId
              ? { ...c, replies: [...c.replies, addedReply] }
              : c
          )
        );
        setName("");
        setMessage("");
        setReplyingTo(null);
      }
    } catch (error) {
      console.error("Failed to submit reply:", error);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden relative bg-gradient-to-br from-yellow-300 via-pink-500 to-lime-400">
      {/* Chaotic background elements */}
      {isMounted && (
        <div className="absolute inset-0 opacity-30">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute bg-red-600 rounded-full animate-ping"
              style={{
                width: Math.random() * 100 + "px",
                height: Math.random() * 100 + "px",
                left: Math.random() * 100 + "%",
                top: Math.random() * 100 + "%",
                animationDelay: Math.random() * 2 + "s",
                animationDuration: Math.random() * 3 + 2 + "s",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 p-4 md:p-8">
        {/* Ugly rotating header */}
        <div className="text-center mt-8 mb-8 animate-bounce">
          <h1
            className="text-6xl md:text-9xl font-black text-red-600 drop-shadow-[0_0_25px_rgba(255,0,0,1)] transform"
            style={{
              transform: `rotate(${Math.sin(rotation / 10) * 10}deg)`,
              textShadow:
                "5px 5px 0px #00ff00, -5px -5px 0px #ff00ff, 10px 10px 0px #ffff00",
            }}
          >
            {glitchText}
          </h1>
          <h2 className="text-4xl md:text-6xl font-black text-purple-900 bg-orange-400 inline-block px-4 py-2 rotate-2 border-8 border-dashed border-green-600 mt-4">
            THE BANE OF MY EXISTENCE
          </h2>
        </div>

        {/* Chaotic grid of complaints */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-red-500 border-8 border-yellow-300 p-6 transform -rotate-3 hover:rotate-6 transition-transform">
            <h3 className="text-3xl font-black text-white mb-4 underline decoration-wavy decoration-4">
              STONE AGE TECH
            </h3>
            <p className="text-xl text-yellow-200 font-bold leading-tight">
              PON is literally from the STONE AGE. We have quantum computers and
              we&apos;re still using this GARBAGE???
            </p>
          </div>

          <div className="bg-lime-400 border-8 border-pink-600 p-6 transform rotate-2 hover:-rotate-6 transition-transform">
            <h3 className="text-3xl font-black text-purple-900 mb-4 underline decoration-wavy decoration-4">
              IT SUCKS
            </h3>
            <p className="text-xl text-red-700 font-bold leading-tight">
              Passive Optical Network? More like PASSIVE OPTICAL NIGHTMARE. It
              just sits there... MOCKING ME.
            </p>
          </div>

          <div className="bg-orange-500 border-8 border-blue-600 p-6 transform -rotate-1 hover:rotate-12 transition-transform">
            <h3 className="text-3xl font-black text-white mb-4 underline decoration-wavy decoration-4">
              I HATE IT
            </h3>
            <p className="text-xl text-green-900 font-bold leading-tight">
              Every. Single. Day. PON finds new ways to ruin my life. It&apos;s
              not just bad technology, it&apos;s PERSONAL.
            </p>
          </div>
        </div>

        {/* Chaotic grid of complaints */}
        <div className="bg-gradient-to-r from-purple-600 via-red-500 to-yellow-400 border-8 border-dashed border-black p-8 mb-8 transform -rotate-1">
          <h2 className="text-5xl font-black text-white mb-6 text-center underline decoration-double decoration-8">
            WHY PON IS THE WORST
          </h2>
          <ul className="space-y-4 text-2xl font-bold">
            {[
              "Split ratios that make NO SENSE",
              "Distance limitations that HAUNT MY DREAMS",
              "Splitter losses that STEAL MY BANDWIDTH",
              "Absolute configuration HELL",
              "Troubleshooting is IMPOSSIBLE",
              "Fiber splits everywhere = CHAOS",
              "No dedicated bandwidth : SHARING IS NOT CARING",
              "It is just DSL but with LASERS",
              "You will constantly mix up OLT and ONT?!",
              "24/7 phonecalls to support",
              "I do not understand :(",
            ].map((complaint, i) => (
              <li
                key={i}
                className="bg-yellow-300 text-red-700 p-4 border-4 border-green-600 transform hover:scale-105 transition-transform"
                style={{
                  transform: `rotate(${i % 2 === 0 ? "-1.5deg" : "1.5deg"})`,
                  boxShadow: "8px 8px 0px rgba(0,0,0,0.5)",
                }}
              >
                ❌ {complaint}
              </li>
            ))}
          </ul>
        </div>

        {/* Ugly animated rant section */}
        <div className="bg-pink-500 border-8 border-orange-600 p-8 mb-8">
          <h2 className="text-4xl font-black text-white mb-4 text-center bg-red-600 p-4 transform -rotate-2">
            MY DAILY PON SUFFERING
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { label: "HOURS WASTED", value: "∞" },
              { label: "FRUSTRATION LEVEL", value: "MAX" },
              { label: "SANITY REMAINING", value: "0%" },
              { label: "HATE INTENSITY", value: "💯" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-yellow-400 border-4 border-purple-700 p-4 transform hover:rotate-12 transition-transform"
              >
                <div className="text-5xl font-black text-red-600 mb-2">
                  {stat.value}
                </div>
                <div className="text-sm font-bold text-purple-900">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 via-red-600 to-purple-700 border-8 border-yellow-400 p-8 mb-8 transform rotate-1">
          <h2 className="text-5xl font-black text-yellow-300 mb-6 text-center underline decoration-wavy decoration-8 bg-green-600 p-4 transform -rotate-1">
            SHARE YOUR PON RAGE
          </h2>

          <form
            onSubmit={handleSubmitComment}
            className="bg-lime-400 border-8 border-pink-600 p-6 mb-8 transform -rotate-2"
          >
            <div className="mb-4">
              <label className="block text-2xl font-black text-purple-900 mb-2">
                YOUR NAME:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Anonymous PON Hater"
                className="w-full p-4 text-xl font-bold border-4 border-red-600 bg-yellow-200 text-black placeholder-gray-600 focus:outline-none focus:border-green-600 transform hover:rotate-1 transition-transform"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-2xl font-black text-purple-900 mb-2">
                YOUR RAGE MESSAGE:
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us why PON ruined your day..."
                rows={4}
                className="w-full p-4 text-xl font-bold border-4 border-red-600 bg-yellow-200 text-black placeholder-gray-600 focus:outline-none focus:border-green-600 transform hover:rotate-1 transition-transform resize-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-red-600 text-yellow-300 text-3xl font-black p-4 border-4 border-green-600 hover:bg-purple-700 hover:scale-105 transition-all transform hover:rotate-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ boxShadow: "8px 8px 0px rgba(0,0,0,0.5)" }}
            >
              {isSubmitting ? "SUBMITTING..." : "SUBMIT YOUR HATE"}
            </button>
          </form>

          <div className="space-y-4">
            <h3 className="text-4xl font-black text-white text-center bg-red-600 p-4 border-4 border-yellow-400 transform rotate-1">
              COMMUNITY RAGE BOARD ({comments.length})
            </h3>
            {comments.length === 0 ? (
              <div className="bg-yellow-300 border-4 border-purple-700 p-6 text-center transform -rotate-1">
                <p className="text-2xl font-black text-red-600">
                  Be the first to share your PON suffering!
                </p>
              </div>
            ) : (
              comments.map((comment, index) => (
                <div
                  key={comment.id}
                  className="bg-yellow-300 border-4 border-purple-700 p-6 transform hover:scale-105 transition-transform"
                  style={{
                    transform: `rotate(${index % 2 === 0 ? "-1deg" : "1deg"})`,
                    boxShadow: "6px 6px 0px rgba(0,0,0,0.4)",
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xl font-black text-purple-900 bg-pink-400 px-3 py-1 border-2 border-red-600 transform -rotate-2">
                      {comment.name}
                    </span>
                    <span className="text-sm font-bold text-gray-700">
                      {new Date(comment.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-lg font-bold text-red-700 leading-tight mb-4">
                    {comment.message}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {["😡", "💀", "🤬", "🔥", "💩"].map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(comment.id, emoji)}
                        className="bg-orange-400 hover:bg-red-500 border-2 border-black px-3 py-1 text-xl font-black transform hover:scale-110 hover:rotate-12 transition-all"
                      >
                        {emoji} {comment.reactions[emoji] || 0}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() =>
                      setReplyingTo(
                        replyingTo === comment.id ? null : comment.id
                      )
                    }
                    className="bg-lime-400 hover:bg-green-500 text-purple-900 font-black px-4 py-2 border-2 border-black transform hover:rotate-2 transition-all mb-3"
                  >
                    {replyingTo === comment.id
                      ? "CANCEL REPLY"
                      : `REPLY (${comment.replies.length})`}
                  </button>

                  {replyingTo === comment.id && (
                    <div className="bg-pink-400 border-4 border-green-600 p-4 mt-3 transform -rotate-1">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full p-2 mb-2 text-lg font-bold border-2 border-purple-700 bg-yellow-200 text-black"
                      />
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Your reply..."
                        rows={2}
                        className="w-full p-2 mb-2 text-lg font-bold border-2 border-purple-700 bg-yellow-200 text-black resize-none"
                      />
                      <button
                        onClick={() => handleReply(comment.id)}
                        className="bg-red-600 text-yellow-300 font-black px-4 py-2 border-2 border-black hover:bg-purple-700 transform hover:rotate-2 transition-all"
                      >
                        SUBMIT REPLY
                      </button>
                    </div>
                  )}

                  {comment.replies.length > 0 && (
                    <div className="mt-4 space-y-2 pl-4 border-l-4 border-orange-600">
                      {comment.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-lime-300 border-2 border-purple-600 p-3 transform rotate-1"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-black text-purple-900 bg-orange-300 px-2 py-1 border border-red-600">
                              {reply.name}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {new Date(reply.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-bold text-red-700">
                            {reply.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ugly footer */}
        <div className="text-center bg-gradient-to-r from-red-600 via-yellow-400 to-green-500 p-8 border-8 border-dashed border-purple-900 transform rotate-1">
          <p
            className="text-3xl font-black text-white mb-4"
            style={{ textShadow: "3px 3px 0px #000" }}
          >
            PON = PAIN • OUTRAGE • NIGHTMARE
          </p>
          <p className="text-xl font-bold text-black bg-yellow-300 inline-block px-6 py-3 border-4 border-red-600 transform -rotate-2">
            Passive Optical Network? More like PIECE OF NSHIT
          </p>
          <div
            className="mt-6 text-2xl font-black text-pink-300"
            style={{
              textShadow: "0 0 10px #000",
            }}
          >
            🔥 PONHUB.SE - WHERE THE TRUTH IS TOLD 🔥
          </div>
        </div>
      </div>

      {/* Annoying floating elements */}
      <div className="fixed bottom-4 right-4 bg-red-600 text-white text-xl font-black p-4 border-4 border-yellow-400 animate-bounce z-10">
        PON SUCKS!
      </div>
    </div>
  );
}
