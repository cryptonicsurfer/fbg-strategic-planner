import React, { useState } from 'react';
import { Activity, FocusArea, StrategicConcept } from '../types';
import { STATUS_LABELS } from '../constants';

interface ExportButtonProps {
  activities: Activity[];
  focusAreas: FocusArea[];
  concepts: StrategicConcept[];
  year: number;
  selectedConceptId: string | null;
}

const ExportButton: React.FC<ExportButtonProps> = ({
  activities,
  focusAreas,
  concepts,
  year,
  selectedConceptId,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getFocusAreaName = (focusAreaId: string) => {
    return focusAreas.find(fa => fa.id === focusAreaId)?.name || '';
  };

  const getConceptName = (focusAreaId: string) => {
    const fa = focusAreas.find(f => f.id === focusAreaId);
    if (!fa) return '';
    return concepts.find(c => c.id === fa.concept_id)?.name || '';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('sv-SE');
  };

  const formatWeeks = (weeks: number[]) => {
    if (weeks.length === 0) return '';
    // List all weeks, e.g. "v3, 9, 12, 15, 18"
    return 'v' + weeks.join(', ');
  };

  // Generate CSV content
  const generateCSV = () => {
    const headers = [
      'Aktivitet',
      'Fokusområde',
      'Koncept',
      'Startdatum',
      'Slutdatum',
      'Veckor',
      'Ansvarig',
      'Syfte',
      'Tema',
      'Målgrupp',
      'Status',
      'Beskrivning',
    ];

    const rows = activities.map(activity => [
      activity.title,
      getFocusAreaName(activity.focus_area_id),
      getConceptName(activity.focus_area_id),
      formatDate(activity.start_date),
      formatDate(activity.end_date),
      formatWeeks(activity.weeks),
      activity.responsible || '',
      activity.purpose || '',
      activity.theme || '',
      activity.target_group || '',
      STATUS_LABELS[activity.status] || activity.status,
      activity.description || '',
    ]);

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(escapeCSV).join(';')),
    ].join('\n');

    return csvContent;
  };

  // Generate Excel-compatible XML
  const generateExcel = () => {
    const headers = [
      'Aktivitet',
      'Fokusområde',
      'Koncept',
      'Startdatum',
      'Slutdatum',
      'Veckor',
      'Ansvarig',
      'Syfte',
      'Tema',
      'Målgrupp',
      'Status',
      'Beskrivning',
    ];

    const escapeXML = (str: string) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`).join('');

    const dataRows = activities.map(activity => {
      const cells = [
        activity.title,
        getFocusAreaName(activity.focus_area_id),
        getConceptName(activity.focus_area_id),
        formatDate(activity.start_date),
        formatDate(activity.end_date),
        formatWeeks(activity.weeks),
        activity.responsible || '',
        activity.purpose || '',
        activity.theme || '',
        activity.target_group || '',
        STATUS_LABELS[activity.status] || activity.status,
        activity.description || '',
      ];
      return `<Row>${cells.map(c => `<Cell><Data ss:Type="String">${escapeXML(c)}</Data></Cell>`).join('')}</Row>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Aktiviteter ${year}">
    <Table>
      <Row ss:StyleID="Header">${headerRow}</Row>
      ${dataRows.join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

    return xml;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleExportCSV = () => {
    const conceptName = selectedConceptId
      ? concepts.find(c => c.id === selectedConceptId)?.name || 'aktiviteter'
      : 'alla-aktiviteter';
    const filename = `${conceptName.toLowerCase().replace(/\s+/g, '-')}-${year}.csv`;
    downloadFile(generateCSV(), filename, 'text/csv;charset=utf-8');
  };

  const handleExportExcel = () => {
    const conceptName = selectedConceptId
      ? concepts.find(c => c.id === selectedConceptId)?.name || 'aktiviteter'
      : 'alla-aktiviteter';
    const filename = `${conceptName.toLowerCase().replace(/\s+/g, '-')}-${year}.xls`;
    downloadFile(generateExcel(), filename, 'application/vnd.ms-excel');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
        title="Exportera aktiviteter"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span className="hidden lg:inline">Exportera</span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <p className="text-xs text-gray-500 px-2">
                {activities.length} aktiviteter
              </p>
            </div>
            <div className="p-1">
              <button
                onClick={handleExportExcel}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm1.8 18H14l-2-3.4-2 3.4H8.2l2.9-4.5L8.2 11H10l2 3.4 2-3.4h1.8l-2.9 4.5 2.9 4.5zM13 9V3.5L18.5 9H13z"/>
                </svg>
                Exportera som Excel
              </button>
              <button
                onClick={handleExportCSV}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              >
                <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                </svg>
                Exportera som CSV
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ExportButton;
