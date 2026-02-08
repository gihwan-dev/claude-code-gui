//! PTY management commands for the terminal UI.
//!
//! Provides Tauri commands to spawn, write to, resize, and kill PTY sessions.
//! Output is streamed to the frontend via Tauri Channel API.

use std::sync::Mutex;
use tauri::ipc::Channel;
use tauri::State;

use crate::pty_manager::PtyManager;
use crate::types::{PtyError, PtyEvent, SpawnOptions};

/// Spawns a new PTY session and begins streaming output via the channel.
/// Returns the session ID.
#[tauri::command]
#[specta::specta]
pub fn pty_spawn(
    state: State<'_, Mutex<PtyManager>>,
    on_event: Channel<PtyEvent>,
    options: SpawnOptions,
) -> Result<String, PtyError> {
    let mut manager = state.lock().map_err(|e| PtyError::LockError {
        message: e.to_string(),
    })?;
    manager.spawn(options, on_event)
}

/// Writes data to a PTY session's stdin.
#[tauri::command]
#[specta::specta]
pub fn pty_write(
    state: State<'_, Mutex<PtyManager>>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), PtyError> {
    let mut manager = state.lock().map_err(|e| PtyError::LockError {
        message: e.to_string(),
    })?;
    manager.write(&session_id, &data)
}

/// Resizes a PTY session.
#[tauri::command]
#[specta::specta]
pub fn pty_resize(
    state: State<'_, Mutex<PtyManager>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), PtyError> {
    let manager = state.lock().map_err(|e| PtyError::LockError {
        message: e.to_string(),
    })?;
    manager.resize(&session_id, cols, rows)
}

/// Kills a PTY session and cleans up resources.
#[tauri::command]
#[specta::specta]
pub fn pty_kill(state: State<'_, Mutex<PtyManager>>, session_id: String) -> Result<(), PtyError> {
    let mut manager = state.lock().map_err(|e| PtyError::LockError {
        message: e.to_string(),
    })?;
    manager.kill(&session_id)
}
