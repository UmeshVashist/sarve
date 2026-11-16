import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, FileSpreadsheet, Layers, ListOrdered, CheckCircle2 } from 'lucide-react';

export default function DownloadFormatModal({ isOpen, onClose, onConfirmDownload, totalRecords = 0 }) {
  const [selectedFormat, setSelectedFormat] = useState('multi-row'); // 'multi-row' or 'single-line'

  if (!isOpen) return null;

  const handleDownload = () => {
    onConfirmDownload(selectedFormat);
    onClose();
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div
        className="modal-container"
        style={{
          maxWidth: '560px',
          width: '94%',
          borderRadius: '16px',
          padding: '0',
          overflow: 'hidden',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
          background: '#ffffff'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                Download Excel Report
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#94A3B8' }}>
                Select export format for {totalRecords} Prisoner Survey records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#CBD5E1',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '14px' }}>
            Jab kisi prisoner ke multiple advocate hon, to Excel me kaise dikhana hai?
          </label>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Option 1: Multi-Row with Repeated UT/CT & Name */}
            <div
              onClick={() => setSelectedFormat('multi-row')}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: selectedFormat === 'multi-row' ? '2px solid #EA580C' : '1.5px solid #E2E8F0',
                background: selectedFormat === 'multi-row' ? '#FFF7ED' : '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '2px' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={selectedFormat === 'multi-row'}
                    onChange={() => setSelectedFormat('multi-row')}
                    style={{ accentColor: '#EA580C', width: '17px', height: '17px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Layers size={17} color={selectedFormat === 'multi-row' ? '#EA580C' : '#64748B'} />
                    <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#0F172A' }}>
                      Separate Rows (Repeat UT/CT No & Name)
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        background: '#EA580C',
                        color: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontWeight: 600
                      }}
                    >
                      Recommended
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: '#475569', lineHeight: '1.45' }}>
                    Jitne advocate honge, utni alag-alag rows banengi. Har row me <b>UT/CT No</b> aur <b>Name</b> repeat hoga, aur advocate alag row me aayenge.
                  </p>
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px dashed #CBD5E1',
                      fontSize: '11.5px',
                      color: '#64748B',
                      fontFamily: 'monospace'
                    }}
                  >
                    <div>Row 1: [S.No 1] [UT/2026/01] [Ramesh] [Advocate #1 Details...] (All questions)</div>
                    <div style={{ color: '#EA580C', fontWeight: 600 }}>Row 2: [&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;] [UT/2026/01] [Ramesh] [Advocate #2 Details...] (Blank)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 2: Single Line (One Row Per Prisoner) */}
            <div
              onClick={() => setSelectedFormat('single-line')}
              style={{
                padding: '16px',
                borderRadius: '12px',
                border: selectedFormat === 'single-line' ? '2px solid #2563EB' : '1.5px solid #E2E8F0',
                background: selectedFormat === 'single-line' ? '#EFF6FF' : '#F8FAFC',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '2px' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={selectedFormat === 'single-line'}
                    onChange={() => setSelectedFormat('single-line')}
                    style={{ accentColor: '#2563EB', width: '17px', height: '17px', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <ListOrdered size={17} color={selectedFormat === 'single-line' ? '#2563EB' : '#64748B'} />
                    <span style={{ fontWeight: 700, fontSize: '14.5px', color: '#0F172A' }}>
                      Single Line (1 Row Per Prisoner - No Repeat)
                    </span>
                  </div>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', color: '#475569', lineHeight: '1.45' }}>
                    Har prisoner ka pura data sirf ek hi row me aayega. Saare advocates Column D me ek saath comma/separator ke saath rahenge.
                  </p>
                  <div
                    style={{
                      background: '#FFFFFF',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px dashed #CBD5E1',
                      fontSize: '11.5px',
                      color: '#64748B',
                      fontFamily: 'monospace'
                    }}
                  >
                    <div>Row 1: [S.No 1] [UT/2026/01] [Ramesh] [Advocate #1 ; Advocate #2] (All questions)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: selectedFormat === 'multi-row' ? '#EA580C' : '#2563EB',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
          >
            <Download size={16} />
            <span>Download Excel</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
