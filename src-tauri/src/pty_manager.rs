//! PTY session manager using portable-pty.
//!
//! Manages pseudo-terminal sessions for the terminal UI.
//! Each session runs a shell process and streams output via Tauri Channel API.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::thread::JoinHandle;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::ipc::Channel;
use uuid::Uuid;

use crate::types::{PtyError, PtyEvent, SessionInfo, SpawnOptions};

/// Size of the read buffer for PTY output (4KB)
const READ_BUFFER_SIZE: usize = 4096;

/// An active PTY session with its associated resources.
pub struct PtySession {
    /// Writer half of the PTY master (for sending input)
    writer: Box<dyn Write + Send>,
    /// Child process handle
    child: Box<dyn Child + Send + Sync>,
    /// Handle to the reader thread (for cleanup)
    _reader_thread: JoinHandle<()>,
    /// Process ID (used by list(), will be exposed via future commands)
    #[allow(dead_code)]
    pid: Option<u32>,
    /// The master PTY handle (kept alive to prevent EOF)
    _master: Box<dyn MasterPty + Send>,
}

/// Manages multiple PTY sessions.
pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    /// Spawns a new PTY session and starts streaming output via the channel.
    pub fn spawn(
        &mut self,
        options: SpawnOptions,
        on_event: Channel<PtyEvent>,
    ) -> Result<String, PtyError> {
        let session_id = Uuid::new_v4().to_string();

        let pty_system = native_pty_system();

        let pty_pair = pty_system
            .openpty(PtySize {
                rows: options.rows,
                cols: options.cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::SystemError {
                message: e.to_string(),
            })?;

        // Determine shell command
        let shell = options
            .command
            .unwrap_or_else(|| std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string()));

        let mut cmd = CommandBuilder::new(&shell);
        for arg in &options.args {
            cmd.arg(arg);
        }

        // Set working directory
        if let Some(ref cwd) = options.cwd {
            cmd.cwd(cwd);
        } else if let Some(home) = dirs_home() {
            cmd.cwd(home);
        }

        // Set TERM environment variable
        cmd.env("TERM", "xterm-256color");

        // Set additional environment variables
        for (key, value) in &options.env {
            cmd.env(key, value);
        }

        // Spawn the child process on the slave PTY
        let child = pty_pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| PtyError::SpawnError {
                message: e.to_string(),
            })?;

        // Drop the slave immediately after spawn to ensure reader gets EOF when child exits
        drop(pty_pair.slave);

        let pid = child.process_id();

        // Take writer from master (only once)
        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|e| PtyError::IoError {
                message: e.to_string(),
            })?;

        // Create reader from master
        let mut reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|e| PtyError::IoError {
                message: e.to_string(),
            })?;

        // Spawn reader thread
        let event_channel = on_event.clone();
        let reader_thread = std::thread::spawn(move || {
            let mut buf = [0u8; READ_BUFFER_SIZE];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => {
                        // EOF — child process has exited
                        let _ = event_channel.send(PtyEvent::Exit { code: None });
                        break;
                    }
                    Ok(n) => {
                        let _ = event_channel.send(PtyEvent::Output {
                            data: buf[..n].to_vec(),
                        });
                    }
                    Err(e) => {
                        // On macOS/Linux, EIO (errno 5) is expected when the child exits
                        if e.kind() == std::io::ErrorKind::Other || e.raw_os_error() == Some(5) {
                            let _ = event_channel.send(PtyEvent::Exit { code: None });
                        } else {
                            let _ = event_channel.send(PtyEvent::Error {
                                message: e.to_string(),
                            });
                        }
                        break;
                    }
                }
            }
        });

        let session = PtySession {
            writer,
            child,
            _reader_thread: reader_thread,
            pid,
            _master: pty_pair.master,
        };

        self.sessions.insert(session_id.clone(), session);

        log::info!("PTY session spawned: {session_id} (shell: {shell}, pid: {pid:?})");
        Ok(session_id)
    }

    /// Writes data to the PTY session's stdin.
    pub fn write(&mut self, session_id: &str, data: &[u8]) -> Result<(), PtyError> {
        let session =
            self.sessions
                .get_mut(session_id)
                .ok_or_else(|| PtyError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        session
            .writer
            .write_all(data)
            .map_err(|e| PtyError::IoError {
                message: e.to_string(),
            })?;

        session.writer.flush().map_err(|e| PtyError::IoError {
            message: e.to_string(),
        })?;

        Ok(())
    }

    /// Resizes the PTY session.
    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), PtyError> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| PtyError::SessionNotFound {
                session_id: session_id.to_string(),
            })?;

        session
            ._master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| PtyError::ResizeError {
                message: e.to_string(),
            })?;

        log::debug!("PTY session resized: {session_id} ({cols}x{rows})");
        Ok(())
    }

    /// Kills a PTY session and cleans up resources.
    pub fn kill(&mut self, session_id: &str) -> Result<(), PtyError> {
        let mut session =
            self.sessions
                .remove(session_id)
                .ok_or_else(|| PtyError::SessionNotFound {
                    session_id: session_id.to_string(),
                })?;

        // Kill the child process
        session.child.kill().map_err(|e| PtyError::IoError {
            message: e.to_string(),
        })?;

        log::info!("PTY session killed: {session_id}");
        Ok(())
    }

    /// Returns information about all active sessions.
    #[allow(dead_code)]
    pub fn list(&mut self) -> Vec<SessionInfo> {
        self.sessions
            .iter_mut()
            .map(|(id, session)| {
                let is_alive = session
                    .child
                    .try_wait()
                    .map(|status| status.is_none())
                    .unwrap_or(false);

                SessionInfo {
                    id: id.clone(),
                    pid: session.pid,
                    is_alive,
                }
            })
            .collect()
    }
}

/// Returns the user's home directory.
fn dirs_home() -> Option<String> {
    std::env::var("HOME").ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use tauri::ipc::InvokeResponseBody;

    /// Helper to create a Channel<PtyEvent> for tests.
    /// The callback receives InvokeResponseBody (serialized JSON), which we
    /// deserialize back into PtyEvent for the test receiver.
    fn test_channel() -> (Channel<PtyEvent>, mpsc::Receiver<PtyEvent>) {
        let (tx, rx) = mpsc::channel();
        let channel = Channel::new(move |body: InvokeResponseBody| {
            if let InvokeResponseBody::Json(json_str) = body {
                if let Ok(event) = serde_json::from_str::<PtyEvent>(&json_str) {
                    let _ = tx.send(event);
                }
            }
            Ok(())
        });
        (channel, rx)
    }

    fn default_spawn_options() -> SpawnOptions {
        SpawnOptions {
            command: Some("/bin/echo".to_string()),
            args: vec!["hello from pty".to_string()],
            cwd: None,
            env: HashMap::new(),
            cols: 80,
            rows: 24,
        }
    }

    fn cat_spawn_options() -> SpawnOptions {
        SpawnOptions {
            command: Some("/bin/cat".to_string()),
            args: vec![],
            cwd: None,
            env: HashMap::new(),
            cols: 80,
            rows: 24,
        }
    }

    #[test]
    fn test_spawn_and_read_output() {
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager.spawn(default_spawn_options(), channel).unwrap();
        assert!(!session_id.is_empty());

        // Collect output with a timeout
        let mut output = Vec::new();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);

        loop {
            match rx.recv_timeout(deadline.saturating_duration_since(std::time::Instant::now())) {
                Ok(PtyEvent::Output { data }) => {
                    output.extend_from_slice(&data);
                }
                Ok(PtyEvent::Exit { .. }) => break,
                Ok(PtyEvent::Error { .. }) => break,
                Err(_) => break,
            }
        }

        let output_str = String::from_utf8_lossy(&output);
        assert!(
            output_str.contains("hello from pty"),
            "Expected 'hello from pty' in output, got: {output_str}"
        );

        // Session should still be in manager (echo exited but wasn't killed)
        assert_eq!(manager.sessions.len(), 1);
    }

    #[test]
    fn test_spawn_and_kill() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let session_id = manager.spawn(cat_spawn_options(), channel).unwrap();
        assert_eq!(manager.sessions.len(), 1);

        manager.kill(&session_id).unwrap();
        assert_eq!(manager.sessions.len(), 0);
    }

    #[test]
    fn test_kill_nonexistent_session() {
        let mut manager = PtyManager::new();
        let result = manager.kill("nonexistent");
        assert!(result.is_err());
        if let Err(PtyError::SessionNotFound { session_id }) = result {
            assert_eq!(session_id, "nonexistent");
        } else {
            panic!("Expected SessionNotFound error");
        }
    }

    #[test]
    fn test_write_to_session() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let session_id = manager.spawn(cat_spawn_options(), channel).unwrap();

        let result = manager.write(&session_id, b"test input\n");
        assert!(result.is_ok());

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_resize_session() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let session_id = manager.spawn(cat_spawn_options(), channel).unwrap();

        let result = manager.resize(&session_id, 120, 40);
        assert!(result.is_ok());

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_list_sessions() {
        let mut manager = PtyManager::new();
        let (channel1, _rx1) = test_channel();
        let (channel2, _rx2) = test_channel();

        let id1 = manager.spawn(cat_spawn_options(), channel1).unwrap();
        let _id2 = manager.spawn(cat_spawn_options(), channel2).unwrap();

        let sessions = manager.list();
        assert_eq!(sessions.len(), 2);

        manager.kill(&id1).unwrap();
        let sessions = manager.list();
        assert_eq!(sessions.len(), 1);
    }
}
