import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Button,
  DataGridShell,
  DataGridToolbar,
  Dialog,
  FormLayout,
  InlineAlert,
  PageHeader,
  Surface,
  TextField,
  type PdsDataGridColumn
} from '@appfw/pds-health-components';
import { useAction, useAsync } from '../../app/providers';
import { entityByType } from '../../lib/entities';
import type { AppfwRecord } from '../../lib/appfwClient';
import { AsyncSection, EnumBadge, formatDateTime } from '../../components/ui';

const meetingEntity = entityByType('Meeting');

type Row = AppfwRecord & { id: string };

export function MeetingCenterScreen() {
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [organizer, setOrganizer] = useState('');

  const state = useAsync(
    (client) =>
      client.queryList(meetingEntity, {
        limit: 50,
        sort: { created_at: 'desc' },
        selection: [
          'id',
          'subject',
          'source',
          'status',
          'start_time',
          'organizer_email',
          'bpmn_status',
          'created_at'
        ]
      }),
    []
  );

  const createMeeting = useAction((client, input: AppfwRecord) =>
    client.saveRecord(meetingEntity, 'create', input)
  );

  const columns: PdsDataGridColumn<Row>[] = [
    {
      key: 'subject',
      header: 'Subject',
      width: '32%',
      render: (row) => <Link to={`/meeting-center/${row.id}`}>{String(row.subject ?? '—')}</Link>
    },
    { key: 'source', header: 'Source', width: '12%' },
    {
      key: 'status',
      header: 'Status',
      width: '16%',
      render: (row) => <EnumBadge value={row.status} />
    },
    { key: 'organizer_email', header: 'Organizer', width: '22%' },
    {
      key: 'created_at',
      header: 'Created',
      width: '18%',
      align: 'end',
      render: (row) => formatDateTime(row.created_at)
    }
  ];

  return (
    <>
      <PageHeader
        title="Meeting center"
        subtitle="Transcript capture for process discovery. AI extraction is gated behind the spec-004 egress boundary (not yet built)."
        actions={
          <Button variant="primary" onClick={() => setAddOpen(true)}>
            Register meeting
          </Button>
        }
      />
      <InlineAlert
        tone="neutral"
        title="Graph writes are disabled"
        detail="Scheduling / cancelling Teams meetings is write-gated pending the G1 governed-write stack. Register meetings manually and paste a VTT on the detail screen."
      />
      <Surface>
        <DataGridToolbar
          ariaLabel="Meetings"
          summary={
            state.status === 'ready' ? `${state.data?.page.queryCount ?? 0} meetings` : null
          }
        />
        <AsyncSection
          state={state}
          isEmpty={(data) => data.rows.length === 0}
          emptyTitle="No meetings registered"
        >
          {(data) => (
            <DataGridShell
              ariaLabel="Meetings"
              columns={columns}
              rows={data.rows as Row[]}
              rowKey="id"
              onRowSelect={(row) => navigate(`/meeting-center/${row.id}`)}
            />
          )}
        </AsyncSection>
      </Surface>

      <Dialog
        open={addOpen}
        title="Register meeting"
        description="Creates a Meeting row you can attach a transcript to. No Microsoft Graph call is made."
        onClose={() => setAddOpen(false)}
        closeLabel="Close register dialog"
        footer={
          <>
            <Button variant="quiet" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={createMeeting.pending}
              disabled={!subject.trim()}
              onClick={async () => {
                const created = await createMeeting.run({
                  subject: subject.trim(),
                  source: 'manual',
                  status: 'scheduled',
                  join_url: joinUrl.trim() || null,
                  organizer_email: organizer.trim() || null
                });
                if (created && typeof created.id === 'string') {
                  setAddOpen(false);
                  setSubject('');
                  setJoinUrl('');
                  setOrganizer('');
                  navigate(`/meeting-center/${created.id}`);
                }
              }}
            >
              Register
            </Button>
          </>
        }
      >
        {createMeeting.error && (
          <InlineAlert tone="danger" title="Create failed" detail={createMeeting.error.message} />
        )}
        <FormLayout columns="one">
          <TextField
            label="Subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
          <TextField
            label="Join URL"
            value={joinUrl}
            onChange={(event) => setJoinUrl(event.target.value)}
          />
          <TextField
            label="Organizer email"
            type="email"
            value={organizer}
            onChange={(event) => setOrganizer(event.target.value)}
          />
        </FormLayout>
      </Dialog>
    </>
  );
}
