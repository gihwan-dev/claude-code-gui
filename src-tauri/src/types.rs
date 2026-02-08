//! Shared types and validation functions for the Tauri application.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
use std::sync::LazyLock;

/// Default shortcut for the quick pane
pub const DEFAULT_QUICK_PANE_SHORTCUT: &str = "CommandOrControl+Shift+.";

/// Maximum size for recovery data files (10MB)
pub const MAX_RECOVERY_DATA_BYTES: u32 = 10_485_760;

/// Pre-compiled regex pattern for filename validation.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub static FILENAME_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$")
        .expect("Failed to compile filename regex pattern")
});

// ============================================================================
// Preferences
// ============================================================================

/// Application preferences that persist to disk.
/// Only contains settings that should be saved between sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    pub theme: String,
    /// Global shortcut for quick pane (e.g., "CommandOrControl+Shift+.")
    /// If None, uses the default shortcut
    pub quick_pane_shortcut: Option<String>,
    /// User's preferred language (e.g., "en", "es", "de")
    /// If None, uses system locale detection
    pub language: Option<String>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            quick_pane_shortcut: None, // None means use default
            language: None,            // None means use system locale
        }
    }
}

// ============================================================================
// Recovery Errors
// ============================================================================

/// Error types for recovery operations (typed for frontend matching)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum RecoveryError {
    /// File does not exist (expected case, not a failure)
    FileNotFound,
    /// Filename validation failed
    ValidationError { message: String },
    /// Data exceeds size limit
    DataTooLarge { max_bytes: u32 },
    /// File system read/write error
    IoError { message: String },
    /// JSON serialization/deserialization error
    ParseError { message: String },
}

impl std::fmt::Display for RecoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RecoveryError::FileNotFound => write!(f, "File not found"),
            RecoveryError::ValidationError { message } => write!(f, "Validation error: {message}"),
            RecoveryError::DataTooLarge { max_bytes } => {
                write!(f, "Data too large (max {max_bytes} bytes)")
            }
            RecoveryError::IoError { message } => write!(f, "IO error: {message}"),
            RecoveryError::ParseError { message } => write!(f, "Parse error: {message}"),
        }
    }
}

// ============================================================================
// PTY Types
// ============================================================================

/// Error types for PTY operations (typed for frontend matching)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum PtyError {
    /// System-level error
    SystemError { message: String },
    /// Session not found
    SessionNotFound { session_id: String },
    /// Failed to spawn PTY process
    SpawnError { message: String },
    /// I/O error during read/write
    IoError { message: String },
    /// Failed to resize PTY
    ResizeError { message: String },
    /// Failed to acquire lock
    LockError { message: String },
    /// Validation error (invalid command, path, etc.)
    ValidationError { message: String },
    /// Resource limit reached
    ResourceLimit { message: String },
}

impl std::fmt::Display for PtyError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PtyError::SystemError { message } => write!(f, "System error: {message}"),
            PtyError::SessionNotFound { session_id } => {
                write!(f, "Session not found: {session_id}")
            }
            PtyError::SpawnError { message } => write!(f, "Spawn error: {message}"),
            PtyError::IoError { message } => write!(f, "IO error: {message}"),
            PtyError::ResizeError { message } => write!(f, "Resize error: {message}"),
            PtyError::LockError { message } => write!(f, "Lock error: {message}"),
            PtyError::ValidationError { message } => write!(f, "Validation error: {message}"),
            PtyError::ResourceLimit { message } => write!(f, "Resource limit: {message}"),
        }
    }
}

/// Events streamed from PTY to frontend via Tauri Channel
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "event", content = "data")]
pub enum PtyEvent {
    /// Raw output bytes from the PTY
    Output { data: Vec<u8> },
    /// PTY process exited
    Exit { code: Option<i32> },
    /// Error occurred in the PTY
    Error { message: String },
}

/// Options for spawning a new PTY session
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SpawnOptions {
    /// Shell command to run (defaults to $SHELL or /bin/zsh)
    pub command: Option<String>,
    /// Arguments to pass to the command
    #[serde(default)]
    pub args: Vec<String>,
    /// Working directory (defaults to user's home)
    pub cwd: Option<String>,
    /// Additional environment variables
    #[serde(default)]
    pub env: HashMap<String, String>,
    /// Terminal columns
    pub cols: u16,
    /// Terminal rows
    pub rows: u16,
}

/// Information about an active PTY session
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SessionInfo {
    /// Unique session identifier
    pub id: String,
    /// Process ID of the shell
    pub pid: Option<u32>,
    /// Whether the session is still alive
    pub is_alive: bool,
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validates a filename for safe file system operations.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if filename.chars().count() > 100 {
        return Err("Filename too long (max 100 characters)".to_string());
    }

    if !FILENAME_PATTERN.is_match(filename) {
        return Err(
            "Invalid filename: only alphanumeric characters, dashes, underscores, and dots allowed"
                .to_string(),
        );
    }

    Ok(())
}

/// Validates theme value.
pub fn validate_theme(theme: &str) -> Result<(), String> {
    match theme {
        "light" | "dark" | "system" => Ok(()),
        _ => Err("Invalid theme: must be 'light', 'dark', or 'system'".to_string()),
    }
}
