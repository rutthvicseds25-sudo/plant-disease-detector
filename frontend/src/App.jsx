import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Info
} from 'lucide-react';
import SymptomQuestionnaire from './SymptomQuestionnaire';

const API_BASE_URL = 'http://127.0.0.1:8000';

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [segMethod, setSegMethod] = useState('none');
  const [includeHeatmap, setIncludeHeatmap] = useState(true);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('gradcam');
  const [backendOnline, setBackendOnline] = useState(null);
  const fileInputRef = useRef(null);
  // Questionnaire state
const [symptomAnswers, setSymptomAnswers] = useState({
  spots: '',
  yellowing: '',
  wilting: '',
  spreading: '',
  leaf_affected: '',
  multiple_leaves: ''
});

const [additionalObservations, setAdditionalObservations] = useState('');

const handleAnswerChange = (question, answer) => {
  setSymptomAnswers((previous) => ({
    ...previous,
    [question]: answer
  }));
};

  // Check Backend Health
  const checkBackendHealth = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      if (res.ok) {
        setBackendOnline(true);
        setError(null);
      } else {
        setBackendOnline(false);
      }
    } catch {
      setBackendOnline(false);
    }
  };

  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Handle File Selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
    }
  };

  // Drag & Drop handlers
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
    }
  };

  // Generate Sample Canvas Leaf for instant 1-click test
  const loadDemoSample = (conditionType) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, 256, 256);

    // Leaf body
    ctx.beginPath();
    ctx.ellipse(128, 128, 80, 105, 0, 0, 2 * Math.PI);
    ctx.fillStyle = conditionType === 'healthy' ? '#15803d' : '#22c55e';
    ctx.fill();

    // Leaf vein
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(128, 30);
    ctx.lineTo(128, 226);
    ctx.stroke();

    // Disease spots
    if (conditionType === 'early_blight') {
      ctx.fillStyle = '#78350f';
      for (let i = 0; i < 7; i++) {
        const x = 100 + (i % 3) * 28;
        const y = 80 + i * 16;
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    } else if (conditionType === 'late_blight') {
      ctx.fillStyle = '#451a03';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(120 + i * 8, 110 + i * 18, 14, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    canvas.toBlob((blob) => {
      const file = new File([blob], `${conditionType}_leaf_sample.jpg`, { type: 'image/jpeg' });
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResults(null);
      setError(null);
    }, 'image/jpeg');
  };

  // Submit Prediction
  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('symptoms', JSON.stringify(symptomAnswers));

formData.append(
  'additional_observations',
  additionalObservations
);

    try {
      const url = `${API_BASE_URL}/predict?include_heatmap=${includeHeatmap}&seg_method=${segMethod}`;
      const res = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Inference server returned error: ${res.statusText}`);
      }

      const data = await res.json();
      setResults(data);
      if (data.gradcam_heatmap_base64) {
        setActiveTab('gradcam');
      } else {
        setActiveTab('original');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* Navigation & Header */}
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">🌿</span>
          <div>
            <h1 className="brand-title">AgriVision AI</h1>
            <p className="brand-subtitle">Plant Pathology & Explainable AI (Grad-CAM) Platform</p>
          </div>
        </div>

        <div className={`status-badge ${backendOnline ? 'status-online' : 'status-offline'}`}>
          <span className="status-dot"></span>
          {backendOnline === null
            ? 'Checking API...'
            : backendOnline
            ? 'FastAPI Backend Online'
            : 'FastAPI Offline (Port 8000)'}
        </div>
      </nav>

      {/* Main Dashboard Layout */}
      <div className="dashboard-grid">
        {/* Left Card: Input & Configuration */}
        <div className="card">
          <h2 className="card-title">
            <UploadCloud size={20} color="#10b981" /> Upload Leaf Specimen
          </h2>

          {/* Drag & Drop Area */}
          <div
            className="dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <UploadCloud className="upload-icon" />
            <p className="dropzone-text">Click or drag & drop leaf photograph</p>
            <p className="dropzone-subtext">Supports JPG, PNG, WEBP formats</p>
          </div>

          {/* Quick Benchmark Samples */}
          <div className="samples-section">
            <p className="samples-label">Quick 1-Click Test Samples:</p>
            <div className="samples-list">
              <button
                type="button"
                className="sample-btn"
                onClick={() => loadDemoSample('early_blight')}
              >
                🍅 Tomato Early Blight
              </button>
              <button
                type="button"
                className="sample-btn"
                onClick={() => loadDemoSample('late_blight')}
              >
                🥔 Potato Late Blight
              </button>
              <button
                type="button"
                className="sample-btn"
                onClick={() => loadDemoSample('healthy')}
              >
                🫑 Healthy Leaf
              </button>
            </div>
          </div>

          {/* Preprocessing & Model Controls */}
          <div className="controls-group">
            <div className="control-item">
              <span className="control-label">Background Suppression (ROI):</span>
              <select
                className="select-input"
                value={segMethod}
                onChange={(e) => setSegMethod(e.target.value)}
              >
                <option value="none">None (Raw Leaf)</option>
                <option value="hsv">HSV Color Mask</option>
                <option value="otsu">Otsu Thresholding</option>
              </select>
            </div>

            <div className="control-item">
              <span className="control-label">Generate Grad-CAM Heatmap:</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={includeHeatmap}
                  onChange={(e) => setIncludeHeatmap(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>
          <SymptomQuestionnaire
            answers={symptomAnswers}
            onAnswerChange={handleAnswerChange}
            observations={additionalObservations}
            onObservationsChange={setAdditionalObservations}
/>

          {/* Submit Button */}
          <button
            className="btn-primary"
            onClick={handleAnalyze}
            disabled={!selectedFile || loading}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="spin-animate" /> Analyzing with CNN...
              </>
            ) : (
              <>
                <Zap size={18} /> Run AI Diagnosis & Grad-CAM
              </>
            )}
          </button>

          {error && (
            <div style={{ marginTop: '16px', padding: '12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
              ⚠️ <strong>Error:</strong> {error}
              {!backendOnline && (
                <div style={{ marginTop: '6px', color: '#7f1d1d' }}>
                  Make sure your backend is running: <code>python run.py api --port 8000</code>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Card: AI Diagnosis & Explainability Results */}
        <div className="card">
          <h2 className="card-title">
            <Activity size={20} color="#10b981" /> Diagnostic Results & XAI
          </h2>

          {results ? (
            <div>
              {/* Diagnosis Header */}
              <div className="result-header">
                <div>
                  <h3 className="diagnosis-title">
                    {results.plant} - {results.condition}
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b' }}>
                    Diagnosed by MobileNetV3 with High-Resolution Grad-CAM
                  </p>
                </div>

                <span
                  className={`diagnosis-badge ${
                    results.is_healthy ? 'badge-healthy' : 'badge-diseased'
                  }`}
                >
                  {results.is_healthy ? (
                    <>
                      <CheckCircle2 size={16} /> Healthy Plant
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} /> Disease Detected
                    </>
                  )}
                </span>
              </div>

              {/* View Switcher Tabs */}
              {results.gradcam_heatmap_base64 && (
                <div className="image-tabs">
                  <button
                    className={`tab-btn ${activeTab === 'gradcam' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gradcam')}
                  >
                    🔥 Grad-CAM Heatmap (XAI)
                  </button>
                  <button
                    className={`tab-btn ${activeTab === 'original' ? 'active' : ''}`}
                    onClick={() => setActiveTab('original')}
                  >
                    📷 Original Leaf
                  </button>
                </div>
              )}

              {/* Image Display */}
              <div className="image-viewer">
                {activeTab === 'gradcam' && results.gradcam_heatmap_base64 ? (
                  <img
                    src={`data:image/jpeg;base64,${results.gradcam_heatmap_base64}`}
                    alt="Grad-CAM Activation"
                  />
                ) : (
                  <img src={previewUrl} alt="Original Leaf" />
                )}
              </div>

              {/* Confidence Progress Bar */}
              <div className="confidence-box">
                <div className="confidence-header">
                  <span>Confidence Score</span>
                  <span style={{ color: '#059669' }}>
                    {(results.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(results.confidence * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Performance Latency Metric */}
              <div className="metrics-row">
                <div className="metric-pill">
                  <span>Inference Latency:</span>
                  <span className="metric-val">{results.inference_latency_ms} ms</span>
                </div>
                <div className="metric-pill">
                  <span>Model Architecture:</span>
                  <span className="metric-val">MobileNetV3</span>
                </div>
              </div>

              {/* Questionnaire Assessment */}
{results.symptom_assessment && (
  <div className="remedy-card">
    <div className="remedy-title">
      🌿 Additional Symptom Assessment
    </div>

    <p className="remedy-text">
      Preliminary symptom score: {
        results.symptom_assessment.score
      }
    </p>

    <p className="remedy-text">
      Symptom indicator: {
        results.symptom_assessment.risk_level
      }
    </p>

    <p className="remedy-text">
      This is a preliminary indicator based on reported observations,
      not a confirmed measure of disease severity.
    </p>

    {results.symptom_assessment.additional_observations && (
      <p className="remedy-text">
        Additional observations: {
          results.symptom_assessment.additional_observations
        }
      </p>
    )}
  </div>
)}

              {/* Agronomic Remedy Advice */}
              <div className="remedy-card">
                <div className="remedy-title">
                  <Sparkles size={16} color="#059669" /> Recommended Agronomic Action
                </div>
                <p className="remedy-text">{results.remedy}</p>
              </div>

              {/* Top-3 Diagnostic Probabilities */}
              {results.top3_predictions && (
                <div style={{ marginTop: '20px' }}>
                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>
                    Top Probability Distribution:
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {results.top3_predictions.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '12px',
                          padding: '6px 10px',
                          background: '#f8fafc',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <span style={{ fontWeight: '600' }}>
                          {p.class.replace('___', ' : ').replace('_', ' ')}
                        </span>
                        <span style={{ fontWeight: '700', color: '#059669' }}>
                          {(p.probability * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              {previewUrl ? (
                <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center' }}>
                  <div className="image-viewer" style={{ marginBottom: '16px' }}>
                    <img src={previewUrl} alt="Selected Leaf" />
                  </div>
                  <p style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>
                    Leaf Specimen Ready
                  </p>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Click "Run AI Diagnosis & Grad-CAM" to analyze
                  </p>
                </div>
              ) : (
                <>
                  <div className="empty-icon">🍃</div>
                  <p style={{ fontSize: '16px', fontWeight: '600', color: '#475569' }}>
                    No Leaf Selected Yet
                  </p>
                  <p style={{ fontSize: '13px', maxWidth: '300px', marginTop: '4px' }}>
                    Upload a plant leaf photo or pick a quick test sample from the left panel.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
