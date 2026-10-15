import { useEffect, useState } from 'react';
import { Clock3, Save } from 'lucide-react';
import Button from '../components/Button.jsx';
import { ErrorState, LoadingState } from '../components/DataState.jsx';
import { apiRequest } from '../services/api.js';

const defaultSettings = {
  schoolName: '',
  workStartTime: '08:00',
  workEndTime: '16:00',
  gracePeriodMinutes: 10,
  timeZone: 'UTC',
};

export default function SystemSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    apiRequest('/settings')
      .then((data) => { if (active) setSettings(data.settings); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  function retryLoad() {
    setLoading(true);
    setError('');
    setRefresh((value) => value + 1);
  }

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const data = await apiRequest('/settings', {
        method: 'PATCH',
        body: {
          ...settings,
          gracePeriodMinutes: Number(settings.gracePeriodMinutes),
        },
      });
      setSettings(data.settings);
      setNotice('Attendance settings saved and audited.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="page-content"><LoadingState label="Loading school settings" /></main>;
  if (error && !settings.schoolName) return <main className="page-content"><ErrorState message={error} onRetry={retryLoad} /></main>;

  return (
    <main className="page-content">
      <div className="page-heading"><p className="eyebrow">ADMINISTRATION</p><h2>System settings</h2></div>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <form className="data-panel settings-form" onSubmit={saveSettings}>
        <div className="data-panel__heading"><div><p className="eyebrow">ATTENDANCE POLICY</p><h3>School workday</h3><p>These rules are applied by the server when attendance is recorded.</p></div><Clock3 size={20} aria-hidden="true" /></div>
        <label className="field settings-form__wide"><span>School name</span><input required minLength={2} maxLength={160} value={settings.schoolName} onChange={(event) => setSettings({ ...settings, schoolName: event.target.value })} /></label>
        <label className="field"><span>Work start</span><input type="time" required value={settings.workStartTime} onChange={(event) => setSettings({ ...settings, workStartTime: event.target.value })} /></label>
        <label className="field"><span>Work end</span><input type="time" required value={settings.workEndTime} onChange={(event) => setSettings({ ...settings, workEndTime: event.target.value })} /></label>
        <label className="field"><span>Grace period <small>minutes</small></span><input type="number" min="0" max="240" required value={settings.gracePeriodMinutes} onChange={(event) => setSettings({ ...settings, gracePeriodMinutes: event.target.value })} /></label>
        <label className="field settings-form__wide"><span>Time zone</span><input list="faculty-timezones" required value={settings.timeZone} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })} /><datalist id="faculty-timezones"><option value="UTC" /><option value="Africa/Lagos" /><option value="Europe/London" /><option value="America/New_York" /></datalist></label>
        <div className="settings-form__footer"><p>On-time check-in ends at work start plus the grace period. An unrecorded teacher becomes absent after work end.</p><Button type="submit" loading={saving}><Save size={16} aria-hidden="true" />Save settings</Button></div>
      </form>
    </main>
  );
}
