/** CSV cells may be interpreted as spreadsheet formulas even when quoted.
 * Metadata comes from remote catalogs and imported playlists, not trusted code.
 * Keep the original metadata unchanged in JSON, UI and saved progress; only
 * prefix dangerous CSV cells with Excel/LibreOffice's text marker.
 */
const FORMULA_START=/^[\s\uFEFF\u200B-\u200D]*[=+\-@]/u;
const CONTROL_START=/^[\t\r\n]/u;

export function csvCell(value) {
  const text=String(value??'');
  const literal=FORMULA_START.test(text) || CONTROL_START.test(text) ? "'"+text : text;
  return '"'+literal.replaceAll('"','""')+'"';
}

export function csvRows(rows) {
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
