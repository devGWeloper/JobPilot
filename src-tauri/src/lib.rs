mod storage;

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("JobPilot 실행에 실패했습니다");
}
