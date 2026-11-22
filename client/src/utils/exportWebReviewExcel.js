import * as XLSX from 'xlsx';

export function downloadWebReviewExcel(records, filename = 'Web_Review_Report.xlsx') {
  if (!records || records.length === 0) {
    alert('No web review records to export!');
    return;
  }

  // Find maximum number of reviews in any single record
  let maxReviews = 1;
  records.forEach((r) => {
    const list = Array.isArray(r.reviews) ? r.reviews : [];
    if (list.length > maxReviews) maxReviews = list.length;
  });

  const excelRows = records.map((r, index) => {
    const row = {
      'S.No': index + 1,
      'Website Name': r.website_name || '',
      'Website URL': r.url || ''
    };

    const reviewList = Array.isArray(r.reviews) ? r.reviews : (r.reviews ? [r.reviews] : []);
    
    // Combined reviews column
    row['All Reviews'] = reviewList.map((rev, i) => `[${i + 1}] ${rev}`).join(' | ');

    // Also provide separate columns: Review 1, Review 2, etc.
    for (let k = 0; k < maxReviews; k++) {
      row[`Review ${k + 1}`] = reviewList[k] || '';
    }

    row['Recorded Date & Time'] = r.created_at ? new Date(r.created_at).toLocaleString() : '';
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);

  // Column width calculations
  const keys = Object.keys(excelRows[0] || {});
  worksheet['!cols'] = keys.map((k) => ({
    wch: k === 'S.No' ? 6 : Math.min(Math.max(k.length + 4, 18), 45)
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Web Reviews');
  XLSX.writeFile(workbook, filename);
}
