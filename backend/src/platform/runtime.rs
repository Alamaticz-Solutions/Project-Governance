//! Single chokepoint for the framework runtime crate (backend framework
//! re-adoption slice 2 -- docs/architecture/framework-readopt-plan.md).
//!
//! Re-exports the framework runtime crate `appfw_runtime` directly.

#![allow(unused_imports)]
#![allow(ambiguous_glob_reexports)]

pub use appfw_runtime::*;
