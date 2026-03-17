import ReportPage from './ReportPage';

const COLUMNS = [
  { key: 'created_at', label: 'Date' },
  { key: 'customer_name', label: 'Customer' },
  { key: 'change_type', label: 'Change Type' },
  { key: 'old_value', label: 'Old Value' },
  { key: 'new_value', label: 'New Value' },
  { key: 'changed_by_name', label: 'Changed By' },
];

export default function SubscriptionChangesReportPage() {
  return <ReportPage title="Subscription Changes Report" endpoint="subscription-changes" columns={COLUMNS} />;
}
