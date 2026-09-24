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
