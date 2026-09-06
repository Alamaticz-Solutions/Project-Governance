//! Data-shape contract for `.appfw/model/**/relationships/*.yaml`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RelationshipKind {
    OneToOne,
    OneToMany,
    ManyToMany,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RelationshipStorageType {
    ForeignKey,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipEndpoint {
    pub schema: Option<String>,
    pub entity: String,
    pub field: String,
    pub caption: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipStorage {
    #[serde(rename = "type")]
    pub storage_type: RelationshipStorageType,
    pub owner_schema: Option<String>,
    pub owner: String,
    pub field: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipJunction {
    pub schema: Option<String>,
    pub entity: String,
    pub left_key: String,
    pub right_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipConfig {
    pub name: String,
    pub kind: RelationshipKind,
    pub left: Option<RelationshipEndpoint>,
    pub right: Option<RelationshipEndpoint>,
    pub one: Option<RelationshipEndpoint>,
    pub many: Option<RelationshipEndpoint>,
    pub storage: Option<RelationshipStorage>,
    pub junction: Option<RelationshipJunction>,
}

#[derive(Debug, Clone)]
pub struct SchemaRelationships {
    pub schema_name: String,
    pub relationships: Vec<RelationshipConfig>,
}
