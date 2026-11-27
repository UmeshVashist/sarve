import * as XLSX from 'xlsx';

export function downloadPassMsExcel(entries = []) {
  if (!entries || entries.length === 0) {
    alert('Export karne ke liye koi Pass MS data uplabdh nahi hai.');
    return;
  }

  const rows = entries.map((item, idx) => ({
    'S.No': idx + 1,
    'Title': item.title || '',
    'Website / Login URL': item.url || '',
    'Username / Email': item.username || '',
    'Password': item.password || '',
    'Notes': item.notes || '',
    'Created At': item.created_at ? new Date(item.created_at).toLocaleString() : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Pass_MS_Vault');

  // Column width styling
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 25 },
    { wch: 35 },
    { wch: 28 },
    { wch: 24 },
    { wch: 20 },
    { wch: 22 }
  ];

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Pass_MS_Credentials_${dateStr}.xlsx`);
}
