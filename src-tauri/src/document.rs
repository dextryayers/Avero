use serde::{Deserialize, Serialize};

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMeta {
    pub id: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

pub const MAX_CANVAS_SIDE: u32 = 16384;
pub const MAX_FULL_PIXELS: u64 = 2048 * 2048;
pub const MAX_HISTORY_FULL: u32 = 15;
pub const MAX_HISTORY_LARGE: u32 = 8;

#[allow(dead_code)]
impl DocumentMeta {
    pub fn new(name: String, width: u32, height: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            width: width.clamp(1, MAX_CANVAS_SIDE),
            height: height.clamp(1, MAX_CANVAS_SIDE),
            created_at: chrono::Utc::now(),
        }
    }

    pub fn pixels(&self) -> u64 {
        self.width as u64 * self.height as u64
    }

    pub fn needs_tiled(&self) -> bool {
        self.pixels() > MAX_FULL_PIXELS
    }

    pub fn history_cap(&self) -> u32 {
        if self.pixels() > 8 * 1024 * 1024 {
            MAX_HISTORY_LARGE
        } else {
            MAX_HISTORY_FULL
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_huge_canvas() {
        let d = DocumentMeta::new("t".into(), 99999, 99999);
        assert_eq!(d.width, 16384);
        assert_eq!(d.height, 16384);
    }

    #[test]
    fn clamp_zero_canvas() {
        let d = DocumentMeta::new("t".into(), 0, 0);
        assert_eq!(d.width, 1);
        assert_eq!(d.height, 1);
    }

    #[test]
    fn id_unique() {
        let a = DocumentMeta::new("a".into(), 100, 100);
        let b = DocumentMeta::new("b".into(), 100, 100);
        assert_ne!(a.id, b.id);
    }
}
