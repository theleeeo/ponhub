package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Comment mirrors the Next.js stub shape
// id is a string; timestamp is milliseconds since epoch
// so the frontend can drop this in without changes.
type Comment struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Message   string `json:"message"`
	Timestamp int64  `json:"timestamp"`
}

var db *sql.DB

func main() {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required (e.g., postgres://user:pass@localhost:5432/comments?sslmode=disable)")
	}

	var err error
	db, err = sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()

	// Reasonable connection pool defaults
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
	mux.Handle("/comments", withCORS(http.HandlerFunc(commentsHandler)))

	port := os.Getenv("SRV_PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func commentsHandler(w http.ResponseWriter, r *http.Request) {
	// CORS preflight already handled in withCORS
	switch r.Method {
	case http.MethodGet:
		getComments(w, r)
	case http.MethodPost:
		postComment(w, r)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

func getComments(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Order newest first to mirror the Next stub behavior
	rows, err := db.QueryContext(ctx, `
		SELECT id::text,
			   name,
			   message,
			   (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS ts
		FROM comments
		ORDER BY id DESC
		LIMIT 50`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch comments"})
		return
	}
	defer rows.Close()

	out := make([]Comment, 0, 32)
	for rows.Next() {
		var c Comment
		if err := rows.Scan(&c.ID, &c.Name, &c.Message, &c.Timestamp); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to decode comments"})
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to read comments"})
		return
	}

	writeJSON(w, http.StatusOK, out)
}

func postComment(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var payload struct {
		Name    *string `json:"name"`
		Message *string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	name := strings.TrimSpace(deref(payload.Name))
	message := strings.TrimSpace(deref(payload.Message))
	if name == "" || message == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Name and message are required"})
		return
	}

	var c Comment
	// created_at defaults to NOW(); we return ms-since-epoch to match stub
	err := db.QueryRowContext(ctx, `
		INSERT INTO comments (name, message)
		VALUES ($1, $2)
		RETURNING id::text,
		          name,
		          message,
		          (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS ts`,
		name, message,
	).Scan(&c.ID, &c.Name, &c.Message, &c.Timestamp)
	if err != nil {
		log.Printf("insert error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create comment"})
		return
	}

	writeJSON(w, http.StatusCreated, c)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		log.Printf("writeJSON error: %v", err)
	}
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
