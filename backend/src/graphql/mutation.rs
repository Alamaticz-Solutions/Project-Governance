use async_graphql::{Context, Object, SimpleObject};
use crate::services::meeting_agent_service::{self, ActionItem, AgendaItem};
use crate::state::AppState;

pub struct MutationRoot;

#[derive(SimpleObject)]
pub struct GqlActionItem {
    pub text: String,
    pub assignee: String,
}

#[derive(SimpleObject)]
pub struct GqlAgendaItem {
    pub project: String,
    pub department: Option<String>,
}

#[derive(SimpleObject)]
pub struct ProcessTranscriptResponse {
    pub summary: String,
    pub decisions: Vec<String>,
    pub action_items: Vec<GqlActionItem>,
    pub agenda_items: Vec<GqlAgendaItem>,
    pub contains_process_flow: bool,
    pub process_name: Option<String>,
    pub bpmn_xml: Option<String>,
}

#[Object]
impl MutationRoot {
    async fn process_transcript(
        &self,
        ctx: &Context<'_>,
        transcript: String,
    ) -> async_graphql::Result<ProcessTranscriptResponse> {
        let state = ctx.data::<AppState>().unwrap();

        // 1. Extract structured data
        let extraction = meeting_agent_service::extract_meeting_notes(
            &state.http,
            &state.config,
            &transcript,
        )
        .await
        .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        // 2. If it contains a process flow, generate BPMN
        let mut bpmn_xml = None;
        if extraction.contains_process_flow {
            let xml = meeting_agent_service::generate_bpmn(
                &state.http,
                &state.config,
                &transcript,
            )
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;
            bpmn_xml = Some(xml);
        }

        Ok(ProcessTranscriptResponse {
            summary: extraction.summary,
            decisions: extraction.decisions,
            action_items: extraction
                .action_items
                .into_iter()
                .map(|a| GqlActionItem {
                    text: a.text,
                    assignee: a.assignee,
                })
                .collect(),
            agenda_items: extraction
                .agenda_items
                .into_iter()
                .map(|a| GqlAgendaItem {
                    project: a.project,
                    department: a.department,
                })
                .collect(),
            contains_process_flow: extraction.contains_process_flow,
            process_name: extraction.process_name,
            bpmn_xml,
        })
    }
}
