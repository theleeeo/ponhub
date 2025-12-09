package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// Comment mirrors the Next.js stub shape
// id is a string; timestamp is milliseconds since epoch
// so the frontend can drop this in without changes.
type Comment struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Message   string  `json:"message"`
	Timestamp int64   `json:"timestamp"`
	ParentID  *string `json:"parentCommentId,omitempty"`
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
	mux.Handle("/reactions", withCORS(http.HandlerFunc(reactionsHandler)))

	port := os.Getenv("API_PORT")
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

func reactionsHandler(w http.ResponseWriter, r *http.Request) {
	// CORS preflight already handled in withCORS
	switch r.Method {
	case http.MethodPost:
		postReaction(w, r)
	default:
		http.Error(w, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
	}
}

type CommentDTO struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Message   string         `json:"message"`
	Timestamp int64          `json:"timestamp"`
	Replies   []CommentDTO   `json:"replies"`
	Reactions map[string]int `json:"reactions"`
}

func getComments(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Fetch comments
	rows, err := db.QueryContext(ctx, `
		SELECT id,
			   name,
			   message,
			   (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS ts,
			   parent_id
		FROM comments
		ORDER BY id DESC
		LIMIT 100`)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch comments"})
		return
	}
	defer rows.Close()

	out := make([]Comment, 0, 32)
	for rows.Next() {
		var c Comment
		if err := rows.Scan(&c.ID, &c.Name, &c.Message, &c.Timestamp, &c.ParentID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to decode comments"})
			return
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to read comments"})
		return
	}

	// Fetch reactions for all comment IDs
	commentIDs := make([]string, 0, len(out))
	for _, c := range out {
		commentIDs = append(commentIDs, c.ID)
	}

	reactionsMap := make(map[string]map[string]int)
	if len(commentIDs) > 0 {
		// Build the SQL IN clause dynamically
		args := make([]any, len(commentIDs))
		placeholders := make([]string, len(commentIDs))
		for i, id := range commentIDs {
			args[i] = id
			placeholders[i] = "$" + strconv.Itoa(i+1)
		}
		query := `
			SELECT comment_id, emoji, count
			FROM reactions 
			WHERE comment_id IN (` + strings.Join(placeholders, ",") + `)
		`
		reactionRows, err := db.QueryContext(ctx, query, args...)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch reactions"})
			return
		}

		defer reactionRows.Close()
		for reactionRows.Next() {
			var commentID, emoji string
			var count int
			if err := reactionRows.Scan(&commentID, &emoji, &count); err == nil {
				if reactionsMap[commentID] == nil {
					reactionsMap[commentID] = make(map[string]int)
				}
				reactionsMap[commentID][emoji] = count
			}
		}

	}

	// Convert flat comments to nested CommentDTOs
	dtoMap := make(map[string]*CommentDTO)
	var roots []CommentDTO

	for _, c := range out {
		dto := CommentDTO{
			ID:        c.ID,
			Name:      c.Name,
			Message:   c.Message,
			Timestamp: c.Timestamp,
			Replies:   []CommentDTO{},
			Reactions: reactionsMap[c.ID],
		}
		if dto.Reactions == nil {
			dto.Reactions = make(map[string]int)
		}
		dtoMap[c.ID] = &dto
	}

	for _, c := range out {
		if c.ParentID != nil && dtoMap[*c.ParentID] != nil {
			parent := dtoMap[*c.ParentID]
			parent.Replies = append(parent.Replies, *dtoMap[c.ID])

			// Sort replies by ID
			replies := parent.Replies
			sort.Slice(replies, func(i, j int) bool {
				return replies[i].ID < replies[j].ID
			})
			parent.Replies = replies
		} else {
			roots = append(roots, *dtoMap[c.ID])
		}
	}

	outDTO := roots

	writeJSON(w, http.StatusOK, outDTO)
}

func postComment(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var payload struct {
		Name     *string `json:"name"`
		Message  *string `json:"message"`
		ParentID *string `json:"parentId"`
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
		INSERT INTO comments (name, message, parent_id)
		VALUES ($1, $2, $3)
		RETURNING id,
		          name,
		          message,
		          (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS ts,
				  parent_id`,
		name, message, payload.ParentID,
	).Scan(&c.ID, &c.Name, &c.Message, &c.Timestamp, &c.ParentID)
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

func postReaction(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var payload struct {
		CommentID string `json:"commentId"`
		Emoji     string `json:"emoji"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON body"})
		return
	}

	if payload.CommentID == "" || payload.Emoji == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Comment ID and emoji are required"})
		return
	}

	_, err := db.ExecContext(ctx, `
		INSERT INTO reactions (comment_id, emoji, count)
		VALUES ($1, $2, 1)
		ON CONFLICT (comment_id, emoji) DO UPDATE
		SET count = reactions.count + 1
	`, payload.CommentID, payload.Emoji)
	if err != nil {
		log.Printf("insert reaction error: %v", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to record reaction"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "reaction recorded"})
}
