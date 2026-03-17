import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ApiError } from '@/lib/api';

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'delivery_agent', label: 'Delivery Agent' },
  { value: 'billing_staff', label: 'Billing Staff' },
  { value: 'read_only', label: 'Read Only' },
];

export default function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: existing } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get<{ data: { name: string; email: string; role: string } }>(`/api/v1/users/${id}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing?.data) {
      setForm({ name: existing.data.name, email: existing.data.email, password: '', role: existing.data.role });
    }
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      isEdit ? api.put(`/api/v1/users/${id}`, data) : api.post('/api/v1/users', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); navigate('/users'); },
    onError: (err: ApiError) => {
      if (err.errors) setErrors(Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])));
      else setErrors({ _form: err.message });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
    if (form.password) payload.password = form.password;
    else if (!isEdit) { setErrors({ password: 'Password is required' }); return; }
    mutation.mutate(payload);
  }

  const fieldClass = (name: string) =>
    `w-full rounded-md border ${errors[name] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-4">{isEdit ? 'Edit User' : 'New User'}</h1>

      {errors._form && <div role="alert" className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{errors._form}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label htmlFor="uname" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input id="uname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass('name')} required />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="uemail" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input id="uemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass('email')} required />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="upassword" className="block text-sm font-medium text-gray-700 mb-1">
            Password {isEdit ? '(leave blank to keep current)' : '*'}
          </label>
          <input id="upassword" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={fieldClass('password')} {...(!isEdit ? { required: true } : {})} />
          {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="urole" className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
          <select id="urole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={fieldClass('role')}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate('/users')} className="rounded-md border border-gray-300 px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50">
            {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
