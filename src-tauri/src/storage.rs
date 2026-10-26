use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

/// data 폴더 위치를 정한다.
/// JOBPILOT_DATA_DIR 환경변수가 있으면 그것을, 없으면 실행 파일 옆 data/를 쓴다.
/// 환경변수는 개발과 테스트에서 쓴다.
pub fn data_root() -> Result<PathBuf, String> {
    if let Ok(dir) = std::env::var("JOBPILOT_DATA_DIR") {
        return Ok(PathBuf::from(dir));
    }
    let exe = std::env::current_exe().map_err(|e| format!("실행 파일 경로를 찾지 못했습니다: {e}"))?;
    let dir = exe
        .parent()
        .ok_or_else(|| "실행 파일의 상위 폴더가 없습니다".to_string())?;
    Ok(dir.join("data"))
}

/// 논리 키를 실제 파일 경로로 바꾼다.
/// key는 "config" 또는 "tasks/2026-08" 형태다.
/// 상위 경로 탈출과 절대 경로를 막는다.
pub fn resolve_path(root: &Path, key: &str) -> Result<PathBuf, String> {
    todo!()
}

pub fn read_text(root: &Path, key: &str) -> Result<Option<String>, String> {
    todo!()
}

pub fn write_atomic(root: &Path, key: &str, contents: &str) -> Result<(), String> {
    todo!()
}

pub fn quarantine(root: &Path, key: &str, stamp: &str) -> Result<String, String> {
    todo!()
}

pub fn backup_once_per_day(root: &Path, today: &str) -> Result<(), String> {
    todo!()
}

pub fn prune_backups(root: &Path, keep: usize) -> Result<(), String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn root() -> TempDir {
        TempDir::new().unwrap()
    }

    #[test]
    fn resolve_path_maps_key_to_json_file() {
        let d = root();
        let p = resolve_path(d.path(), "config").unwrap();
        assert_eq!(p, d.path().join("config.json"));
    }

    #[test]
    fn resolve_path_supports_one_subdirectory() {
        let d = root();
        let p = resolve_path(d.path(), "tasks/2026-08").unwrap();
        assert_eq!(p, d.path().join("tasks").join("2026-08.json"));
    }

    #[test]
    fn resolve_path_rejects_parent_escape() {
        let d = root();
        assert!(resolve_path(d.path(), "../secret").is_err());
        assert!(resolve_path(d.path(), "tasks/../../secret").is_err());
    }

    #[test]
    fn resolve_path_rejects_absolute_key() {
        let d = root();
        assert!(resolve_path(d.path(), "/etc/passwd").is_err());
        assert!(resolve_path(d.path(), "C:\\Windows\\system.ini").is_err());
    }

    #[test]
    fn resolve_path_rejects_empty_key() {
        let d = root();
        assert!(resolve_path(d.path(), "").is_err());
    }

    #[test]
    fn read_text_returns_none_when_missing() {
        let d = root();
        assert_eq!(read_text(d.path(), "config").unwrap(), None);
    }

    #[test]
    fn write_then_read_roundtrips() {
        let d = root();
        write_atomic(d.path(), "config", "{\"a\":1}").unwrap();
        assert_eq!(
            read_text(d.path(), "config").unwrap(),
            Some("{\"a\":1}".to_string())
        );
    }

    #[test]
    fn write_creates_missing_subdirectory() {
        let d = root();
        write_atomic(d.path(), "tasks/2026-08", "[]").unwrap();
        assert!(d.path().join("tasks").join("2026-08.json").exists());
    }

    #[test]
    fn write_replaces_existing_content() {
        let d = root();
        write_atomic(d.path(), "config", "old").unwrap();
        write_atomic(d.path(), "config", "new").unwrap();
        assert_eq!(read_text(d.path(), "config").unwrap(), Some("new".into()));
    }

    #[test]
    fn write_leaves_no_temp_file_behind() {
        let d = root();
        write_atomic(d.path(), "config", "x").unwrap();
        let leftovers: Vec<_> = fs::read_dir(d.path())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".tmp"))
            .collect();
        assert!(leftovers.is_empty(), "임시 파일이 남았습니다");
    }

    #[test]
    fn quarantine_moves_file_aside_and_reports_path() {
        let d = root();
        write_atomic(d.path(), "config", "broken{{").unwrap();
        let moved = quarantine(d.path(), "config", "20260803T101500").unwrap();
        assert!(!d.path().join("config.json").exists());
        assert!(Path::new(&moved).exists());
        assert!(moved.contains("corrupt"));
    }

    #[test]
    fn quarantine_errors_when_file_missing() {
        let d = root();
        assert!(quarantine(d.path(), "config", "20260803T101500").is_err());
    }

    #[test]
    fn backup_copies_data_files_into_dated_folder() {
        let d = root();
        write_atomic(d.path(), "config", "c").unwrap();
        write_atomic(d.path(), "tasks/2026-08", "t").unwrap();

        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        let dir = d.path().join("backups").join("2026-08-03");
        assert_eq!(fs::read_to_string(dir.join("config.json")).unwrap(), "c");
        assert_eq!(
            fs::read_to_string(dir.join("tasks").join("2026-08.json")).unwrap(),
            "t"
        );
    }

    #[test]
    fn backup_skips_when_today_already_backed_up() {
        let d = root();
        write_atomic(d.path(), "config", "first").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        write_atomic(d.path(), "config", "second").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();

        let backed = d.path().join("backups").join("2026-08-03").join("config.json");
        assert_eq!(fs::read_to_string(backed).unwrap(), "first");
    }

    #[test]
    fn backup_does_not_recurse_into_backups_folder() {
        let d = root();
        write_atomic(d.path(), "config", "c").unwrap();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();
        backup_once_per_day(d.path(), "2026-08-04").unwrap();

        let nested = d
            .path()
            .join("backups")
            .join("2026-08-04")
            .join("backups");
        assert!(!nested.exists(), "백업 폴더가 자기 자신을 복사했습니다");
    }

    #[test]
    fn backup_succeeds_when_no_data_files_exist() {
        let d = root();
        backup_once_per_day(d.path(), "2026-08-03").unwrap();
        assert!(d.path().join("backups").join("2026-08-03").exists());
    }

    #[test]
    fn prune_keeps_newest_and_removes_oldest() {
        let d = root();
        for day in ["2026-08-01", "2026-08-02", "2026-08-03"] {
            fs::create_dir_all(d.path().join("backups").join(day)).unwrap();
        }

        prune_backups(d.path(), 2).unwrap();

        let backups = d.path().join("backups");
        assert!(!backups.join("2026-08-01").exists());
        assert!(backups.join("2026-08-02").exists());
        assert!(backups.join("2026-08-03").exists());
    }

    #[test]
    fn prune_is_noop_when_under_limit() {
        let d = root();
        fs::create_dir_all(d.path().join("backups").join("2026-08-03")).unwrap();
        prune_backups(d.path(), 30).unwrap();
        assert!(d.path().join("backups").join("2026-08-03").exists());
    }

    #[test]
    fn prune_is_noop_when_backups_dir_missing() {
        let d = root();
        assert!(prune_backups(d.path(), 30).is_ok());
    }
}
