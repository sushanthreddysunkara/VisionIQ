import { FileSpreadsheet, Sparkles, Upload } from 'lucide-react'

export default function DataImportRequired({ projectName, featureName = 'data', onImport, onLoadSample }) {
  return (
    <div className="project-coming-soon-page data-import-required-page">
      <div className="project-coming-soon-icon" style={{ background: '#e0ecff', color: '#1d58d8' }}>
        <FileSpreadsheet size={28} />
      </div>

      <p className="section-kicker">PROJECT CONNECTED: {projectName?.toUpperCase() || 'PLATFORM A'}</p>
      <h1>CSV Dataset Required</h1>
      <p>
        To view and analyze <strong>{featureName}</strong>, please upload a traffic CSV file. The system will
        dynamically construct the data models, entity relationships, and visualizations from your dataset.
      </p>

      <div className="data-import-actions">
        <label className="data-import-file-btn">
          <Upload size={16} />
          <span>Upload CSV File</span>
          <input accept=".csv,text/csv" onChange={onImport} type="file" style={{ display: 'none' }} />
        </label>

        {onLoadSample && (
          <button className="data-import-sample-btn" onClick={onLoadSample} type="button">
            <Sparkles size={15} />
            <span>Load Sample Dataset</span>
          </button>
        )}
      </div>

      <div className="data-import-hint">
        <span>Supported columns:</span>
        <code>type</code>
        <code>location</code>
        <code>camera</code>
        <code>timestamp</code>
        <code>volume</code>
        <code>pedestrians</code>
      </div>
    </div>
  )
}
