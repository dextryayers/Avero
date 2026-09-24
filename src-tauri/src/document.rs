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

#[allow(dead_code)]
impl DocumentMeta {
    pub fn new(name: String, width: u32, height: u32) -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            width: width.clamp(1, 16384),
            height: height.clamp(1, 16384),
            created_at: chrono::Utc::now(),
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
