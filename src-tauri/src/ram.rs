use serde::Serialize;

pub const MAX_SIDE: u32 = 16384;
pub const FULL_PIXELS: u64 = 2048 * 2048;
pub const TILE: u32 = 512;
pub const MAX_IPC_BYTES: usize = 256 * 1024 * 1024;

#[derive(Serialize, Clone)]
pub struct RamBudget {
    pub width: u32,
    pub height: u32,
    pub layers: u32,
    pub bytes_per_layer: u64,
    pub total_mb: f64,
    pub peak_mb: f64,
    pub mode: String,
    pub tile: u32,
    pub history_cap: u32,
}

#[derive(Serialize, Clone)]
pub struct TilePlan {
    pub width: u32,
    pub height: u32,
    pub tile: u32,
    pub cols: u32,
    pub rows: u32,
    pub tiles: u32,
}

#[derive(Serialize, Clone)]
pub struct ExportPlan {
    pub in_w: u32,
    pub in_h: u32,
    pub out_w: u32,
    pub out_h: u32,
    pub scale: u32,
    pub tiled: bool,
    pub tile: u32,
    pub est_mb: f64,
}

fn clamp_side(v: u32) -> u32 {
    v.clamp(1, MAX_SIDE)
}

pub fn budget_for(width: u32, height: u32, layers: u32) -> RamBudget {
    let w = clamp_side(width);
    let h = clamp_side(height);
    let l = layers.clamp(1, 128);
    let per = (w as u64) * (h as u64) * 4;
    let total = per * (l as u64);
    let total_mb = total as f64 / 1024.0 / 1024.0;
    // Peak assumes one full temp buffer for classic filters.
    let peak_mb = (total + per) as f64 / 1024.0 / 1024.0;
    let (mode, tile, cap) = if total_mb > 600.0 || (per as f64 / 1024.0 / 1024.0) > 32.0 {
        ("critical".to_string(), TILE, 4)
    } else if total_mb > 250.0 || (per as f64 / 1024.0 / 1024.0) > 16.0 {
        ("light".to_string(), TILE, 8)
    } else {
        ("full".to_string(), 0, 15)
    };
    RamBudget {
        width: w,
        height: h,
        layers: l,
        bytes_per_layer: per,
        total_mb,
        peak_mb,
        mode,
        tile,
        history_cap: cap,
    }
}

pub fn tiles_for(width: u32, height: u32, tile: u32) -> TilePlan {
    let w = clamp_side(width);
    let h = clamp_side(height);
    let t = tile.clamp(256, 1024);
    let cols = (w + t - 1) / t;
    let rows = (h + t - 1) / t;
    TilePlan {
        width: w,
        height: h,
        tile: t,
        cols,
        rows,
        tiles: cols * rows,
    }
}

pub fn export_for(width: u32, height: u32, scale: u32) -> Result<ExportPlan, String> {
    let s = scale.clamp(10, 400);
    let w = clamp_side(width) as u64;
    let h = clamp_side(height) as u64;
    let out_w = ((w * (s as u64) / 100).max(1).min(MAX_SIDE as u64)) as u32;
    let out_h = ((h * (s as u64) / 100).max(1).min(MAX_SIDE as u64)) as u32;
    let px = (out_w as u64) * (out_h as u64);
    if px > (MAX_SIDE as u64) * (MAX_SIDE as u64) {
        return Err("Export dimensions exceed canvas limits".into());
    }
    let est_mb = (px * 4) as f64 / 1024.0 / 1024.0;
    let tiled = px > FULL_PIXELS;
    Ok(ExportPlan {
        in_w: w as u32,
        in_h: h as u32,
        out_w,
        out_h,
        scale: s,
        tiled,
        tile: if tiled { TILE } else { 0 },
        est_mb,
    })
}

pub fn ipc_guard(len: usize) -> Result<(), String> {
    if len == 0 {
        return Err("Empty buffer".into());
    }
    if len % 4 != 0 {
        return Err("Buffer length must be a multiple of 4".into());
    }
    if len > MAX_IPC_BYTES {
        return Err("Buffer exceeds 256MB IPC limit, use tiled calls".into());
    }
    Ok(())
}

#[tauri::command]
pub fn cmd_ram_budget(width: u32, height: u32, layers: u32) -> RamBudget {
    budget_for(width, height, layers)
}

#[tauri::command]
pub fn cmd_tile_plan(width: u32, height: u32, tile: Option<u32>) -> TilePlan {
    tiles_for(width, height, tile.unwrap_or(TILE))
}

#[tauri::command]
pub fn cmd_export_plan(width: u32, height: u32, scale: Option<u32>) -> Result<ExportPlan, String> {
    export_for(width, height, scale.unwrap_or(100))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn full_mode_small_doc() {
        let b = budget_for(1920, 1080, 3);
        assert_eq!(b.mode, "full");
        assert_eq!(b.history_cap, 15);
    }

    #[test]
    fn critical_mode_huge_doc() {
        let b = budget_for(8000, 8000, 4);
        assert_eq!(b.mode, "critical");
        assert_eq!(b.history_cap, 4);
    }

    #[test]
    fn tile_plan_counts() {
        let p = tiles_for(1200, 800, 512);
        assert_eq!((p.cols, p.rows, p.tiles), (3, 2, 6));
    }

    #[test]
    fn export_uhd_tiles() {
        let p = export_for(1920, 1080, 400).unwrap();
        assert_eq!((p.out_w, p.out_h), (7680, 4320));
        assert!(p.tiled);
    }

    #[test]
    fn export_scale_clamped() {
        let p = export_for(100, 100, 9999).unwrap();
        assert_eq!(p.scale, 400);
    }
}
