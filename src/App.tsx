import { useState } from 'react';
import type { ChangeEvent } from 'react';

// 1. Interface for our AI Response
interface AnalysisResult {
  matchPercentage: number;
  candidateSummary: string;
  strengths: string[];
  missingSkills: string[];
  tailoredElevatorPitch: string;
}

// Sample Mock Data for the "View Sample Result" feature
const SAMPLE_RESULT: AnalysisResult = {
  matchPercentage: 88,
  candidateSummary: "Candidate shows strong expertise in project leadership, cross-functional team management, and strategic execution. Minor skill alignment gaps identified in cloud architecture.",
  strengths: ["Agile & Scrum Methodologies", "Stakeholder Communication", "Budget & Resource Planning", "Data-Driven Decision Making"],
  missingSkills: ["AWS/Azure Cloud Architecture", "Advanced SQL Analytics"],
  tailoredElevatorPitch: "Results-oriented leader with 5+ years of driving complex cross-functional projects to completion. Proven track record in optimizing operational workflows and delivering high-impact team outcomes."
};

export default function App() {
  // Mode tabs: 'paste' | 'upload'
  const [cvMode, setCvMode] = useState<'paste' | 'upload'>('paste');
  const [jdMode, setJdMode] = useState<'paste' | 'upload'>('paste');

  // Input states
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);

  // App UI states
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // File upload handlers
  const handleCvFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCvFile(e.target.files[0]);
    }
  };

  const handleJdFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setJdFile(e.target.files[0]);
    }
  };

  // Analyze using gpt-5-mini
  const handleAnalyze = async () => {
  if (!cvText.trim() || !jdText.trim()) {
    alert('Please enter or paste text in both the CV and Job Description fields first!');
    return;
  }

  setIsLoading(true);
  setResult(null);

  try {
    const response = await fetch('https://smartmatcher.onrender.com/api/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cv_text: cvText,
        jd_text: jdText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || `Server returned error status ${response.status}`);
    }

    const data: AnalysisResult = await response.json();
    console.log('Received Analysis Result:', data);
    setResult(data);
  } catch (error: any) {
    console.error('Error matching skills:', error);
    alert(`Failed to analyze: ${error.message}`);
  } finally {
    setIsLoading(false);
  }
  };

  // View Sample Result button handler
  const handleViewSample = () => {
    setResult(SAMPLE_RESULT);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  // Check if inputs are ready
  const isCvReady = cvMode === 'paste' ? cvText.trim().length > 0 : cvFile !== null;
  const isJdReady = jdMode === 'paste' ? jdText.trim().length > 0 : jdFile !== null;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Smart CV & Skill Matcher</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#666' }}>Analyze how well your CV matches the target Job Description using AI</p>
        </div>

        {/* Feature 2: View Sample Result Link/Button */}
        <button
          onClick={handleViewSample}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#f0f4f8',
            color: '#0066cc',
            border: '1px solid #0066cc',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          View Sample Result ✨
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #eee', marginBottom: '2rem' }} />

      {/* Feature 1: Dual Input Section (Upload & Paste) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* CV Input Box */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Candidate CV</h3>
            <div>
              <button
                onClick={() => setCvMode('paste')}
                style={{
                  padding: '0.3rem 0.6rem',
                  marginRight: '0.25rem',
                  backgroundColor: cvMode === 'paste' ? '#0066cc' : '#e0e0e0',
                  color: cvMode === 'paste' ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Paste Text
              </button>
              <button
                onClick={() => setCvMode('upload')}
                style={{
                  padding: '0.3rem 0.6rem',
                  backgroundColor: cvMode === 'upload' ? '#0066cc' : '#e0e0e0',
                  color: cvMode === 'upload' ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Upload File
              </button>
            </div>
          </div>

          {cvMode === 'paste' ? (
            <textarea
              rows={8}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              placeholder="Paste CV text or experience overview here..."
              value={cvText}
              onChange={(e) => setCvText(e.target.value)}
            />
          ) : (
            <div style={{ border: '2px dashed #ccc', borderRadius: '6px', padding: '2rem', textAlign: 'center', backgroundColor: '#fff' }}>
              <input type="file" accept=".pdf,.docx,.txt" onChange={handleCvFileUpload} id="cv-upload" style={{ display: 'none' }} />
              <label htmlFor="cv-upload" style={{ cursor: 'pointer', color: '#0066cc', fontWeight: 'bold' }}>
                {cvFile ? `📄 ${cvFile.name}` : '📁 Click to upload CV (.pdf, .docx)'}
              </label>
            </div>
          )}
        </div>

        {/* JD Input Box */}
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1.25rem', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Target Job Description</h3>
            <div>
              <button
                onClick={() => setJdMode('paste')}
                style={{
                  padding: '0.3rem 0.6rem',
                  marginRight: '0.25rem',
                  backgroundColor: jdMode === 'paste' ? '#0066cc' : '#e0e0e0',
                  color: jdMode === 'paste' ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Paste Text
              </button>
              <button
                onClick={() => setJdMode('upload')}
                style={{
                  padding: '0.3rem 0.6rem',
                  backgroundColor: jdMode === 'upload' ? '#0066cc' : '#e0e0e0',
                  color: jdMode === 'upload' ? '#fff' : '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Upload File
              </button>
            </div>
          </div>

          {jdMode === 'paste' ? (
            <textarea
              rows={8}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
              placeholder="Paste job description requirements here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          ) : (
            <div style={{ border: '2px dashed #ccc', borderRadius: '6px', padding: '2rem', textAlign: 'center', backgroundColor: '#fff' }}>
              <input type="file" accept=".pdf,.docx,.txt" onChange={handleJdFileUpload} id="jd-upload" style={{ display: 'none' }} />
              <label htmlFor="jd-upload" style={{ cursor: 'pointer', color: '#0066cc', fontWeight: 'bold' }}>
                {jdFile ? `📄 ${jdFile.name}` : '📁 Click to upload JD (.pdf, .docx)'}
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || (!isCvReady && !result) || (!isJdReady && !result)}
          style={{
            padding: '0.85rem 2.5rem',
            fontSize: '1.1rem',
            backgroundColor: (isCvReady && isJdReady) ? '#0066cc' : '#a0c4e8',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: (isCvReady && isJdReady) ? 'pointer' : 'not-allowed',
            fontWeight: 600
          }}
        >
          {isLoading ? '🤖 AI is Analyzing Match...' : 'Analyze Matching Score'}
        </button>
      </div>

      {/* Results Dashboard Section */}
      {result && (
        <div style={{ marginTop: '2.5rem', padding: '1.5rem', border: '2px solid #0066cc', borderRadius: '8px', backgroundColor: '#f8fbff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Matching Results</h2>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0066cc' }}>
              Score: {result.matchPercentage}%
            </span>
          </div>

          <p style={{ marginTop: '1rem', fontSize: '1.05rem', color: '#333' }}>
            <strong>Executive Summary:</strong> {result.candidateSummary}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ color: '#2e7d32', marginTop: 0 }}>✅ Key Match Strengths</h3>
              <ul>
                {result.strengths.map((s, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{s}</li>)}
              </ul>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ color: '#c62828', marginTop: 0 }}>⚠️ Missing / Gap Skills</h3>
              <ul>
                {result.missingSkills.map((m, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{m}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#ffffff', borderLeft: '4px solid #0066cc', borderRadius: '4px' }}>
            <strong style={{ color: '#0066cc' }}>💡 Recommended Elevator Pitch:</strong>
            <p style={{ margin: '0.5rem 0 0', fontStyle: 'italic' }}>"{result.tailoredElevatorPitch}"</p>
          </div>
        </div>
      )}

      {/* Feature 3: 3-Step User Guideline Section */}
      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '3.5rem 0 2rem' }} />

      <div>
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          
          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              1
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Upload or Paste</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Provide your candidate CV and the target Job Description by uploading files or pasting text.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              2
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Check Matching Results</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Review your overall match score, key strengths, missing skills, and a tailored pitch.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              3
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Apply CV Optimization</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Select options to optimize your CV points specifically tailored to highlight missing requirements.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
} 