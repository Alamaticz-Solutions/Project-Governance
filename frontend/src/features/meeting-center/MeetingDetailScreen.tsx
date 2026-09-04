import { useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  Badge,
  Button,
  FormLayout,
  InlineAlert,
  PageHeader,
  Surface,
  TextArea
} from '@ui-kit';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, DefinitionList, EnumBadge, asText, formatDateTime } from '../../components/ui';

const meetingEntity = entityByType('Meeting');

export function MeetingDetailScreen() {
  const { meetingId = '' } = useParams();
  const [vtt, setVtt] = useState('');
  const state = useAsync((client) => client.findRecord(meetingEntity, meetingId), [meetingId]);
  const process = useAction((client, pastedVtt: string) =>
    client.invoke('processTranscript', {
      meetingId,
      payload: pastedVtt.trim() ? { vtt: pastedVtt } : {}
    })
  );

  return (
    <AsyncSection state={state} isEmpty={(record) => !record}>
      {(record) => {
        const meeting = record as AppfwRecord;
        return (
          <>
            <PageHeader
              eyebrow="Meeting"
              title={asText(meeting.subject)}
              subtitle={
                <span>
                  <EnumBadge value={meeting.status} /> · source {asText(meeting.source)}
                </span>
              }
              actions={
                <Link to="/meeting-center">
                  <Button variant="secondary">Back to list</Button>
                </Link>
              }
            />

            <div className="app-work-grid">
              <Surface title="Details">
                <DefinitionList
                  items={[
                    { label: 'Organizer', value: asText(meeting.organizer_email) },
                    { label: 'Start', value: formatDateTime(meeting.start_time) },
                    { label: 'End', value: formatDateTime(meeting.end_time) },
                    { label: 'Join URL', value: asText(meeting.join_url) },
                    {
                      label: 'Graph online meeting',
                      value: asText(meeting.graph_online_meeting_id)
                    },
                    { label: 'Transcript id', value: asText(meeting.graph_transcript_id) },
                    { label: 'AI / BPMN status', value: asText(meeting.bpmn_status) }
                  ]}
                />
              </Surface>

              <Surface
                title="Process transcript"
                subtitle="Fetches a governed Graph transcript when Graph is configured, or uses a pasted VTT. Summary / decisions / action-items are recorded as pending until the spec-004 AI-egress boundary exists."
              >
                {process.error && (
                  <InlineAlert
                    tone={process.error.details.category === 'policy_denied' ? 'warning' : 'danger'}
                    title="process_transcript failed"
                    detail={process.error.message}
                  />
                )}
                <FormLayout
                  columns="one"
                  footer={
                    <Button
                      variant="primary"
                      isLoading={process.pending}
                      onClick={() => process.run(vtt).then(() => state.reload())}
                    >
                      Run process_transcript
                    </Button>
                  }
                >
                  <TextArea
                    label="Paste VTT (optional)"
                    rows={8}
                    value={vtt}
                    onChange={(event) => setVtt(event.target.value)}
                    hint="Leave blank to fetch from Microsoft Graph using the meeting's stored ids."
                  />
                </FormLayout>
              </Surface>
            </div>

            {(meeting.transcript_text || meeting.summary) && (
              <Surface title="Captured content">
                {meeting.summary ? (
                  <>
                    <Badge tone="accent">Summary</Badge>
                    <p>{asText(meeting.summary)}</p>
                  </>
                ) : null}
                {meeting.transcript_text ? (
                  <>
                    <Badge tone="neutral">Transcript</Badge>
                    <pre className="transcript">{asText(meeting.transcript_text)}</pre>
                  </>
                ) : null}
              </Surface>
            )}
          </>
        );
      }}
    </AsyncSection>
  );
}
