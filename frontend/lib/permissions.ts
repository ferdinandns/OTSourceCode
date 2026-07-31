import { permission } from "process";

type Role = 'qs' | 'admin' | 'checker' | 'pic_responsibility';

const baseRolePermissions: Record<string, string[]> = {
  admin: ['manage:user', 'view:user', 'manage:master', 'view:master', 'view:sarpras', 'view:approval', 'view:audit', 'view:notification', 'view:task', 'manage:refill'],
  qs: ['manage:sarpras', 'view:sarpras', 'view:audit', 'manage:review', 'view:notification', 'view:task', 'manage:refill', 'view:inspection', 'view:repair', 'manage:repair'],
  checker: ['view:sarpras', 'manage:inspection', 'view:notification', 'view:task', 'view:inspection'],
  pic_responsibility: ['view:sarpras', 'manage:repair', 'view:master', 'view:notification', 'view:task'],
};

export const allMenus = [
  // Global
  { id: 'dashboard', title: 'Dashboard', path: '/dashboard', group: 'main', isGlobal: true },
  { id: 'sarpras_list', title: 'List Sarpras Emergency', path: '/dashboard/list-sarpras', group: 'main', isGlobal: true },
  { id: 'my_task', title: 'My Tasks', path: '/dashboard/my-task', group: 'main', isGlobal: true },
  { id: 'inspection_report', title: 'Report Pemeriksaan', path: '/dashboard/report', group: 'main', isGlobal: true},

  // Operational
  { id: 'inspection', title: 'Pemeriksaan Sarpras', path: '/dashboard/inspection', group: 'operational', permission: 'view:inspection' },
  { id: 'repair', title: 'Perbaikan', path: '/dashboard/repair', group: 'operational', permission: 'manage:repair' },
  { id: 'review', title: 'Verifikasi Perbaikan', path: '/dashboard/reviews', group: 'operational', permission: 'manage:review' },
  { id: 'audit_log', title: 'Audit Log', path: '/dashboard/audit-log', group: 'operational', permission: 'view:audit' },
  { id: 'refill', title: 'Monitoring ED APAR', path: '/dashboard/refill', group: 'operational', permission: 'manage:refill'},

  // Master
  { id: 'user_mgmt', title: 'Master User', path: '/dashboard/user', group: 'master', permission: 'manage:user' },
  { id: 'master_data', title: 'Master Departemen', path: '/dashboard/department', group: 'master', permission: 'manage:master' },
  { id: 'master_jenis_sarpras', title: 'Master Jenis Sarpras', path: '/dashboard/sarpras-types', group: 'master', permission: 'manage:sarpras'}
];

export function getEffectivePermissions(roles: string[], isSupervisor: boolean): string[] {
  const permSet = new Set<string>();
  let isQS = false;

  for (const role of roles) {
    if (role === 'qs') isQS = true;
    for (const perm of baseRolePermissions[role] ?? []) {
      permSet.add(perm);
    }
  }

  // QS Supervisor dapat approve
  if (isQS && isSupervisor) {
    permSet.add('approve:request');
    permSet.add('view:approval');
  }

  return Array.from(permSet);
}

export function getAvailableMenus(roles: string[], isSupervisor: boolean) {
  const perms = new Set(getEffectivePermissions(roles, isSupervisor));
  return allMenus.filter(m => m.isGlobal || perms.has(m.permission ?? ''));
}