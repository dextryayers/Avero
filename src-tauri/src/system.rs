use serde::Serialize;
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, RefreshKind, System};

#[derive(Serialize, Clone)]
pub struct SystemProfile {
    pub os: String,
    pub arch: String,
    pub cpu_brand: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub total_ram_mb: u64,
    pub free_ram_mb: u64,
    pub used_ram_mb: u64,
    pub app_rss_mb: u64,
    pub render_tile: u32,
    pub fast_path: bool,
}

#[derive(Serialize, Clone)]
pub struct EngineRecommendation {
    pub mode: String,
    pub device: String,
    pub tile: u32,
    pub history_cap: u32,
    pub score: u32,
    pub reason: String,
}

fn sample() -> System {
    System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    )
}

#[tauri::command]
pub fn cmd_system_profile() -> SystemProfile {
    let mut sys = sample();
    sys.refresh_all();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown CPU".into());
    let cpu_cores = sys.cpus().len();
    let cpu_threads = rayon::current_num_threads();
    let total_kb = sys.total_memory();
    let free_kb = sys.free_memory();
    let used_kb = sys.used_memory();
    let app_rss_mb = sysinfo::get_current_pid()
        .ok()
        .and_then(|p| sys.process(p).map(|pr| pr.memory() / 1024 / 1024))
        .unwrap_or(0);
    SystemProfile {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        cpu_brand,
        cpu_cores,
        cpu_threads,
        total_ram_mb: total_kb / 1024,
        free_ram_mb: free_kb / 1024,
        used_ram_mb: used_kb / 1024,
        app_rss_mb,
        render_tile: 512,
        fast_path: true,
    }
}

#[tauri::command]
pub fn cmd_engine_recommend() -> EngineRecommendation {
    let mut sys = sample();
    sys.refresh_memory();
    let total_gb = sys.total_memory() as f64 / 1024.0 / 1024.0;
    let threads = rayon::current_num_threads() as f64;
    // Score 0..100 from RAM and thread count. Potato PCs land low.
    let ram_score = (total_gb / 32.0 * 60.0).min(60.0);
    let cpu_score = (threads / 16.0 * 40.0).min(40.0);
    let score = (ram_score + cpu_score).round().clamp(5.0, 100.0) as u32;
    if score < 35 {
        EngineRecommendation {
            mode: "eco".into(),
            device: "cpu".into(),
            tile: 256,
            history_cap: 4,
            score,
            reason: "Low memory or few cores. Tiled light path with small tiles.".into(),
        }
    } else if score < 70 {
        EngineRecommendation {
            mode: "balanced".into(),
            device: "auto".into(),
            tile: 512,
            history_cap: 8,
            score,
            reason: "Mid range hardware. Tiled path for large files only.".into(),
        }
    } else {
        EngineRecommendation {
            mode: "max".into(),
            device: "gpu".into(),
            tile: 1024,
            history_cap: 15,
            score,
            reason: "Strong hardware. Full pipeline with large tiles.".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_sane() {
        let p = cmd_system_profile();
        assert!(p.total_ram_mb > 0);
        assert!(p.cpu_threads >= 1);
        assert!(!p.cpu_brand.is_empty());
    }

    #[test]
    fn recommend_bounds() {
        let r = cmd_engine_recommend();
        assert!((5..=100).contains(&r.score));
        assert!([256, 512, 1024].contains(&r.tile));
        assert!(r.history_cap >= 4 && r.history_cap <= 15);
    }
}
