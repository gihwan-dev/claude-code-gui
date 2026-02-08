//! PTY session manager using portable-pty.
//!
//! Manages pseudo-terminal sessions for the terminal UI.
//! Each session runs a shell process and streams output via Tauri Channel API.
//!
//! # Security
//!
//! - Shell commands are validated against a whitelist of known shells
//! - Working directories are canonicalized to prevent path traversal
//! - Dangerous environment variables (LD_PRELOAD, etc.) are blocked
//! - Maximum session limit prevents resource exhaustion

use std::collections::HashMap;
use std::io::{Read, Write};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::thread::JoinHandle;

use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use tauri::ipc::Channel;
use uuid::Uuid;

use crate::types::{PtyError, PtyEvent, SessionInfo, SpawnOptions};

/// Size of the read buffer for PTY output (4KB)
const READ_BUFFER_SIZE: usize = 4096;

/// Maximum number of concurrent PTY sessions
const MAX_SESSIONS: usize = 10;

/// Allowed shell commands (absolute paths only)
const ALLOWED_SHELLS: &[&str] = &[
    "/bin/bash",
    "/bin/zsh",
    "/bin/sh",
    "/bin/fish",
    "/usr/bin/bash",
    "/usr/bin/zsh",
    "/usr/bin/fish",
    "/usr/local/bin/bash",
    "/usr/local/bin/zsh",
    "/usr/local/bin/fish",
    "/opt/homebrew/bin/bash",
    "/opt/homebrew/bin/zsh",
    "/opt/homebrew/bin/fish",
];

/// Environment variables that must not be overridden by the frontend
const BLOCKED_ENV_VARS: &[&str] = &[
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "DYLD_FALLBACK_LIBRARY_PATH",
];

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
        // Enforce session limit
        if self.sessions.len() >= MAX_SESSIONS {
            return Err(PtyError::ResourceLimit {
                message: format!("Maximum number of sessions ({MAX_SESSIONS}) reached"),
            });
        }

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

        // Determine and validate shell command
        let shell = options
            .command
            .unwrap_or_else(|| std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string()));

        validate_shell(&shell)?;

        let mut cmd = CommandBuilder::new(&shell);
        if options.args.is_empty() {
            // Run as login shell when no args are provided.
            // CommandBuilder::new() sets is_default_prog=false, so portable-pty
            // won't prefix argv[0] with '-'. The -l flag ensures shell startup
            // files (.zprofile, .bash_profile, etc.) are loaded.
            cmd.arg("-l");
        } else {
            for arg in &options.args {
                cmd.arg(arg);
            }
        }

        // Set working directory (validated)
        if let Some(ref cwd) = options.cwd {
            let validated = validate_cwd(cwd)?;
            cmd.cwd(validated);
        } else if let Some(home) = dirs_home() {
            cmd.cwd(home);
        }

        // Set TERM environment variable
        cmd.env("TERM", "xterm-256color");

        // Set additional environment variables (filtered for safety)
        for (key, value) in &options.env {
            if is_blocked_env_var(key) {
                log::warn!("Blocked dangerous environment variable: {key}");
                continue;
            }
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

        // Spawn reader thread (with panic safety)
        let event_channel = on_event.clone();
        let reader_thread = std::thread::spawn(move || {
            let channel = event_channel;
            let result = catch_unwind(AssertUnwindSafe(|| {
                let mut buf = [0u8; READ_BUFFER_SIZE];
                loop {
                    match reader.read(&mut buf) {
                        Ok(0) => {
                            // EOF — child process has exited
                            let _ = channel.send(PtyEvent::Exit { code: None });
                            break;
                        }
                        Ok(n) => {
                            let _ = channel.send(PtyEvent::Output {
                                data: buf[..n].to_vec(),
                            });
                        }
                        Err(e) => {
                            // On macOS/Linux, EIO (errno 5) is expected when the child exits
                            if e.kind() == std::io::ErrorKind::Other || e.raw_os_error() == Some(5)
                            {
                                let _ = channel.send(PtyEvent::Exit { code: None });
                            } else {
                                let _ = channel.send(PtyEvent::Error {
                                    message: e.to_string(),
                                });
                            }
                            break;
                        }
                    }
                }
            }));

            if let Err(e) = result {
                log::error!("Reader thread panicked: {e:?}");
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

        // Kill the child process (ignore errors if already exited)
        if let Err(e) = session.child.kill() {
            log::debug!("Child process already exited or kill failed: {e}");
        }

        // Reap the zombie process
        let _ = session.child.wait();

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

impl Drop for PtyManager {
    fn drop(&mut self) {
        let session_ids: Vec<String> = self.sessions.keys().cloned().collect();
        for id in &session_ids {
            if let Err(e) = self.kill(id) {
                log::warn!("Failed to kill session {id} during cleanup: {e}");
            }
        }
    }
}

/// Returns the user's home directory.
fn dirs_home() -> Option<String> {
    std::env::var("HOME").ok()
}

/// Validates that the shell command is in the allowed list.
fn validate_shell(shell: &str) -> Result<(), PtyError> {
    if ALLOWED_SHELLS.contains(&shell) {
        Ok(())
    } else {
        Err(PtyError::ValidationError {
            message: format!("Shell not allowed: {shell}"),
        })
    }
}

/// Validates and canonicalizes the working directory path.
fn validate_cwd(path: &str) -> Result<std::path::PathBuf, PtyError> {
    let path = std::path::Path::new(path);

    let canonical = path.canonicalize().map_err(|e| PtyError::ValidationError {
        message: format!("Invalid working directory: {e}"),
    })?;

    if !canonical.is_dir() {
        return Err(PtyError::ValidationError {
            message: "Working directory must be a directory".to_string(),
        });
    }

    Ok(canonical)
}

/// Returns true if the environment variable is blocked for security.
fn is_blocked_env_var(key: &str) -> bool {
    BLOCKED_ENV_VARS.contains(&key)
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
            command: Some("/bin/sh".to_string()),
            args: vec!["-c".to_string(), "echo hello from pty".to_string()],
            cwd: None,
            env: HashMap::new(),
            cols: 80,
            rows: 24,
        }
    }

    /// Spawns an interactive shell for tests that need a long-running process.
    fn interactive_spawn_options() -> SpawnOptions {
        SpawnOptions {
            command: Some("/bin/sh".to_string()),
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

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();
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

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();

        let result = manager.write(&session_id, b"test input\n");
        assert!(result.is_ok());

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_resize_session() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();

        let result = manager.resize(&session_id, 120, 40);
        assert!(result.is_ok());

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_list_sessions() {
        let mut manager = PtyManager::new();
        let (channel1, _rx1) = test_channel();
        let (channel2, _rx2) = test_channel();

        let id1 = manager
            .spawn(interactive_spawn_options(), channel1)
            .unwrap();
        let _id2 = manager
            .spawn(interactive_spawn_options(), channel2)
            .unwrap();

        let sessions = manager.list();
        assert_eq!(sessions.len(), 2);

        manager.kill(&id1).unwrap();
        let sessions = manager.list();
        assert_eq!(sessions.len(), 1);
    }

    #[test]
    fn test_reject_disallowed_shell() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let options = SpawnOptions {
            command: Some("/usr/bin/python3".to_string()),
            args: vec![],
            cwd: None,
            env: HashMap::new(),
            cols: 80,
            rows: 24,
        };

        let result = manager.spawn(options, channel);
        assert!(result.is_err());
        if let Err(PtyError::ValidationError { message }) = result {
            assert!(message.contains("not allowed"));
        } else {
            panic!("Expected ValidationError");
        }
    }

    #[test]
    fn test_reject_invalid_cwd() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let options = SpawnOptions {
            command: Some("/bin/sh".to_string()),
            args: vec![],
            cwd: Some("/nonexistent/path/that/does/not/exist".to_string()),
            env: HashMap::new(),
            cols: 80,
            rows: 24,
        };

        let result = manager.spawn(options, channel);
        assert!(result.is_err());
        if let Err(PtyError::ValidationError { message }) = result {
            assert!(message.contains("Invalid working directory"));
        } else {
            panic!("Expected ValidationError");
        }
    }

    #[test]
    fn test_blocked_env_vars_are_filtered() {
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let mut env = HashMap::new();
        env.insert("LD_PRELOAD".to_string(), "/tmp/evil.so".to_string());
        env.insert("MY_SAFE_VAR".to_string(), "safe_value".to_string());

        let options = SpawnOptions {
            command: Some("/bin/sh".to_string()),
            args: vec![],
            cwd: None,
            env,
            cols: 80,
            rows: 24,
        };

        // Should succeed — blocked vars are filtered, not rejected
        let result = manager.spawn(options, channel);
        assert!(result.is_ok());
        manager.kill(&result.unwrap()).unwrap();
    }

    /// Collects output from the channel until the predicate returns true or timeout.
    /// Returns the accumulated output as a String.
    fn collect_output_until(
        rx: &mpsc::Receiver<PtyEvent>,
        timeout: std::time::Duration,
        predicate: impl Fn(&str) -> bool,
    ) -> String {
        let mut output = String::new();
        let deadline = std::time::Instant::now() + timeout;

        loop {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                break;
            }
            match rx.recv_timeout(remaining) {
                Ok(PtyEvent::Output { data }) => {
                    let chunk = String::from_utf8_lossy(&data);
                    output.push_str(&chunk);
                    if predicate(&output) {
                        break;
                    }
                }
                Ok(PtyEvent::Exit { .. }) | Ok(PtyEvent::Error { .. }) => break,
                Err(_) => break,
            }
        }

        output
    }

    /// Collects events from the channel, tracking both output and exit status.
    /// Returns (accumulated_output, did_exit).
    fn collect_events(
        rx: &mpsc::Receiver<PtyEvent>,
        timeout: std::time::Duration,
        stop_predicate: impl Fn(&str, bool) -> bool,
    ) -> (String, bool) {
        let mut output = String::new();
        let mut exited = false;
        let deadline = std::time::Instant::now() + timeout;

        loop {
            let remaining = deadline.saturating_duration_since(std::time::Instant::now());
            if remaining.is_zero() {
                break;
            }
            match rx.recv_timeout(remaining) {
                Ok(PtyEvent::Output { data }) => {
                    let chunk = String::from_utf8_lossy(&data);
                    output.push_str(&chunk);
                    if stop_predicate(&output, exited) {
                        break;
                    }
                }
                Ok(PtyEvent::Exit { .. }) => {
                    exited = true;
                    if stop_predicate(&output, exited) {
                        break;
                    }
                }
                Ok(PtyEvent::Error { message }) => {
                    panic!("Unexpected error event from PTY: {message}");
                }
                Err(_) => break,
            }
        }

        (output, exited)
    }

    // ===== User scenario tests: exactly mirror TerminalPanel behavior =====

    /// Mirrors TerminalPanel.tsx spawn call: command=None, args=[], cwd=None, env={}
    fn user_scenario_spawn_options() -> SpawnOptions {
        SpawnOptions {
            command: None, // Uses $SHELL (like TerminalPanel sends null)
            args: vec![],  // Empty args (like TerminalPanel)
            cwd: None,
            env: HashMap::new(),
            cols: 99, // Match typical terminal dimensions
            rows: 57,
        }
    }

    #[test]
    fn test_user_scenario_spawn_succeeds() {
        // Test: TerminalPanel calls ptySpawn({ command: null, args: [], ... })
        // Expected: spawn succeeds without error
        let mut manager = PtyManager::new();
        let (channel, _rx) = test_channel();

        let result = manager.spawn(user_scenario_spawn_options(), channel);
        assert!(
            result.is_ok(),
            "Spawn with command=None (user scenario) should succeed, got: {result:?}"
        );

        let session_id = result.unwrap();
        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_user_scenario_shell_stays_alive() {
        // Test: After spawn, shell should NOT exit within 2 seconds.
        // If this fails, the shell is crashing immediately after start.
        // This matches the "연결 끊김" bug — Exit event arrives too soon.
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager
            .spawn(user_scenario_spawn_options(), channel)
            .unwrap();

        // Wait 2 seconds and check if Exit event was received
        let (_, exited) = collect_events(
            &rx,
            std::time::Duration::from_secs(2),
            |_, did_exit| did_exit, // stop immediately if Exit received
        );

        assert!(
            !exited,
            "Shell exited within 2 seconds of spawn! This causes the '연결 끊김' bug."
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_user_scenario_receives_prompt() {
        // Test: After spawn with command=None, shell should produce output (prompt).
        // This tests whether the user sees anything in the terminal.
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager
            .spawn(user_scenario_spawn_options(), channel)
            .unwrap();

        let (output, exited) =
            collect_events(&rx, std::time::Duration::from_secs(3), |s, did_exit| {
                !s.is_empty() || did_exit
            });

        assert!(
            !exited,
            "Shell exited before producing any output! Output so far: '{output}'"
        );
        assert!(
            !output.is_empty(),
            "Expected shell prompt or initial output, got nothing within 3 seconds"
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_user_scenario_command_execution() {
        // Test: User types "echo hello" and presses Enter in the terminal.
        // xterm.js sends \r for Enter key.
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager
            .spawn(user_scenario_spawn_options(), channel)
            .unwrap();

        // Wait for shell to initialize (prompt)
        let (_, exited) = collect_events(&rx, std::time::Duration::from_secs(3), |s, did_exit| {
            !s.is_empty() || did_exit
        });
        assert!(!exited, "Shell exited during initialization");

        // User types "echo HELLO_WORLD" and presses Enter
        let marker = "USER_CMD_MARKER_99";
        manager
            .write(&session_id, format!("echo {marker}\r").as_bytes())
            .unwrap();

        // Expect marker at least twice: echo (PTY echo-back) + command output
        let (output, exited) =
            collect_events(&rx, std::time::Duration::from_secs(3), |s, did_exit| {
                s.matches(marker).count() >= 2 || did_exit
            });

        assert!(
            !exited,
            "Shell exited while processing command! Output: '{output}'"
        );

        let count = output.matches(marker).count();
        assert!(
            count >= 2,
            "Command execution failed. Expected marker '{marker}' at least 2 times (echo + output), found {count}. Full output: '{output}'"
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_user_scenario_channel_continues_working() {
        // Test: Channel keeps receiving events after spawn returns.
        // This verifies the Channel doesn't get invalidated.
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager
            .spawn(user_scenario_spawn_options(), channel)
            .unwrap();

        // Wait for initial prompt
        let (initial, exited) =
            collect_events(&rx, std::time::Duration::from_secs(3), |s, did_exit| {
                !s.is_empty() || did_exit
            });
        assert!(!exited, "Shell exited during startup");
        assert!(!initial.is_empty(), "No initial output received");

        // Wait a moment, then send a command — channel should still work
        std::thread::sleep(std::time::Duration::from_millis(500));

        let marker = "CHANNEL_ALIVE_CHECK";
        manager
            .write(&session_id, format!("echo {marker}\r").as_bytes())
            .unwrap();

        let (output, exited) =
            collect_events(&rx, std::time::Duration::from_secs(3), |s, did_exit| {
                s.contains(marker) || did_exit
            });

        assert!(
            !exited,
            "Shell exited after delay. Channel may have been invalidated. Output: '{output}'"
        );
        assert!(
            output.contains(marker),
            "Channel stopped receiving events after spawn returned. Output: '{output}'"
        );

        manager.kill(&session_id).unwrap();
    }

    // ===== Basic interactive shell tests (using /bin/sh for predictability) =====

    #[test]
    fn test_interactive_shell_produces_output_on_spawn() {
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();

        // Wait up to 3 seconds for ANY output (shell prompt, login message, etc.)
        let output =
            collect_output_until(&rx, std::time::Duration::from_secs(3), |s| !s.is_empty());

        assert!(
            !output.is_empty(),
            "Expected some output from interactive shell (prompt, motd, etc.), got nothing"
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_interactive_command_execution() {
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();

        // Wait for shell initialization (prompt or any initial output)
        collect_output_until(&rx, std::time::Duration::from_secs(3), |s| !s.is_empty());

        // Send a command with carriage return (what xterm.js sends for Enter)
        let marker = "PTYTEST_MARKER_12345";
        manager
            .write(&session_id, format!("echo {marker}\r").as_bytes())
            .unwrap();

        // Collect output until we see the marker at least twice:
        // 1st occurrence: PTY echo of the typed command
        // 2nd occurrence: actual command execution output
        let output = collect_output_until(&rx, std::time::Duration::from_secs(3), |s| {
            s.matches(marker).count() >= 2
        });

        let count = output.matches(marker).count();
        assert!(
            count >= 2,
            "Expected marker '{marker}' at least 2 times (echo + execution), found {count} in output: {output}"
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_enter_key_triggers_execution() {
        let mut manager = PtyManager::new();
        let (channel, rx) = test_channel();

        let session_id = manager.spawn(interactive_spawn_options(), channel).unwrap();

        // Wait for shell initialization
        collect_output_until(&rx, std::time::Duration::from_secs(3), |s| !s.is_empty());

        // Test with \r (0x0D) — what xterm.js sends for Enter key
        let marker_cr = "CR_MARKER_67890";
        manager
            .write(&session_id, format!("echo {marker_cr}\r").as_bytes())
            .unwrap();

        let output_cr = collect_output_until(&rx, std::time::Duration::from_secs(3), |s| {
            s.matches(marker_cr).count() >= 2
        });

        let cr_count = output_cr.matches(marker_cr).count();
        assert!(
            cr_count >= 2,
            "\\r (carriage return) should trigger command execution. Expected marker '{marker_cr}' at least 2 times, found {cr_count} in output: {output_cr}"
        );

        manager.kill(&session_id).unwrap();
    }

    #[test]
    fn test_session_limit() {
        let mut manager = PtyManager::new();

        // Spawn MAX_SESSIONS sessions
        let mut ids = Vec::new();
        for _ in 0..MAX_SESSIONS {
            let (channel, _rx) = test_channel();
            let id = manager.spawn(interactive_spawn_options(), channel).unwrap();
            ids.push(id);
        }

        // Next spawn should fail
        let (channel, _rx) = test_channel();
        let result = manager.spawn(interactive_spawn_options(), channel);
        assert!(result.is_err());
        if let Err(PtyError::ResourceLimit { .. }) = result {
            // Expected
        } else {
            panic!("Expected ResourceLimit error");
        }

        // Cleanup
        for id in &ids {
            manager.kill(id).unwrap();
        }
    }
}
