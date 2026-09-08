//! Product-owned `T <-> JSON object` conversion helpers, ported off
//! `appfw_runtime::json` (backend framework replacement phase 7, slice
//! 6.1). `JsonObj` is a type alias for `RuntimeJsonObj`
//! (`serde_json::Map<String, Value>`, see `platform::provider_result`),
//! not a distinct type -- so, like `RuntimeJsonObj` itself in slice 5,
//! only these two functions actually need porting.

pub type JsonObj = appfw_runtime::RuntimeJsonObj;

pub fn t_to_json_obj<T>(value: T) -> JsonObj
where
    T: Send + Sync + async_graphql::InputType + serde::Serialize + std::fmt::Debug,
{
    let value_json = serde_json::to_value(&value).expect("could not serialize value to JSON");
    value_json
        .as_object()
        .expect("serialized value should be a JSON object")
        .to_owned()
}

pub fn json_obj_to_t<T>(json_obj: JsonObj) -> T
where
    T: Send + Sync + async_graphql::OutputType + for<'de> serde::Deserialize<'de> + std::fmt::Debug,
{
    serde_json::from_value::<T>(json_obj.into()).expect("could not deserialize JSON object")
}
