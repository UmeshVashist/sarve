import React from 'react';

export default function DashboardPage({ onSelectOption }) {
  const options = [
    {
      id: 'prisoner',
      title: 'Prisoner Survey',
      tag: 'Active Module',
      isPrimary: true
    },
    {
      id: 'advocate',
      title: 'Advocate Survey',
      tag: 'Active Module',
      isPrimary: true
    },
    {
      id: 'citizen',
      title: 'Citizen Survey',
      tag: 'Coming Soon',
      isPrimary: false
    },
    {
      id: 'other',
      title: 'Other',
      tag: 'Coming Soon',
      isPrimary: false
    }
  ];

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-title-area">
        <h1 className="dashboard-heading">Select Survey Category</h1>
        <p className="dashboard-subheading">
          Choose a survey category to view recorded records, add new questionnaires, and export Excel reports.
        </p>
      </div>

      {/* 4 Big Peach/Coral Option Cards matching user's uploaded reference image */}
      <div className="cards-grid-4">
        {options.map((opt) => (
          <button
            key={opt.id}
            className="option-card-big"
            onClick={() => onSelectOption(opt.id)}
            title={`Open ${opt.title}`}
          >
            <span className="option-card-title">{opt.title}</span>
            <span className="option-card-tag">{opt.tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

