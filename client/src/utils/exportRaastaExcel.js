import * as XLSX from 'xlsx';

export function downloadRaastaExcel(records, filename = 'Raasta_Function_Report.xlsx') {
  if (!records || records.length === 0) {
    alert('No Raasta Function records to export!');
    return;
  }

  const excelRows = records.map((r, index) => ({
    'S.No': index + 1,
    'Portal Name': r.portal_name || '',
    'Function Name': r.function_name || '',
    'Function Details': r.details || '',
    'Recorded Date & Time': r.created_at ? new Date(r.created_at).toLocaleString() : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  const keys = Object.keys(excelRows[0] || {});
  worksheet['!cols'] = keys.map((k) => ({
    wch: k === 'S.No' ? 6 : Math.min(Math.max(k.length + 4, 18), 45)
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Raasta Functions');
  XLSX.writeFile(workbook, filename);
}
