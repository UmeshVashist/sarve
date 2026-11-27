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
      id: 'new_prisoner',
      title: 'New Prisoner',
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
      id: 'web_review',
      title: 'Web Review',
      tag: 'Active Module',
      isPrimary: true
    },
    {
      id: 'raasta',
      title: 'Raasta Function',
      tag: 'Active Module',
      isPrimary: true
    },
    {
      id: 'work_role',
      title: 'Work Role',
      tag: 'Active Module',
      isPrimary: true
    },
    {
      id: 'doc_store',
      title: 'Doc Store',
      tag: 'R2 Cloud Storage',
      isPrimary: true
    },
    {
      id: 'pass_ms',
      title: 'Pass MS',
      tag: 'Password Vault',
      isPrimary: true
    },
    {
      id: 'one_to_one',
      title: '1 to 1',
      tag: 'Group Chat App',
      isPrimary: true
    }
  ];

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="dashboard-title-area">
        <h1 className="dashboard-heading">Select Survey Category</h1>
        <p className="dashboard-subheading">
          Choose a category to view recorded records, manage options, and export Excel reports.
        </p>
      </div>

      {/* 9 Big Peach/Coral Option Cards */}
      <div className="cards-grid-4 cards-grid-5 cards-grid-6 cards-grid-7 cards-grid-8 cards-grid-9">
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

