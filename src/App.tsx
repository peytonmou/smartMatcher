import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

// 1. Interface for our AI Response
interface DimensionScores {
  hardSkillsScore: number;
  experienceScore: number;
  transferableSkillsScore: number;
}

interface AnalysisResult {
  matchPercentage: number;
  dimensionScores?: DimensionScores;  // add the multi-dimension scores
  candidateSummary: string;
  strengths: string[];
  missingSkills: string[];
  semanticInferences?: string[];    // add semantic inference array
  tailoredElevatorPitch: string;
}

interface AuthenticatedUser {
  user_id: number;
  email_address: string;
  first_login_time: string;
  last_login_time: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const AVATAR_COLORS = ['#0066cc', '#7b2ff7', '#d6249f', '#00897b', '#e65100', '#546e7a'];

function avatarColor(emailAddress: string): string {
  const hash = [...emailAddress].reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// Sample Mock Data for the "View Sample Result" feature
const SAMPLE_RESULT: AnalysisResult = {
  matchPercentage: 88,
  dimensionScores: {
    hardSkillsScore: 90,
    experienceScore: 85,
    transferableSkillsScore: 85
  },
  candidateSummary: "Candidate shows strong technical overlap, especially in .NET ecosystem which strongly aligns with the C# backend requirement. High overall fit for senior roles.",
  strengths: ["C# & .NET Core Ecosystem", "Agile & Scrum Methodologies", "Stakeholder Communication", "Relational Databases (Oracle/SQL)"],
  missingSkills: ["AWS Cloud Native Architecture", "GraphQL APIs"],
  semanticInferences: [
    "Inferred proficiency in C# based on 4+ years of .NET Core development.",
    "Mapped Oracle database experience to meet general Relational SQL requirements."
  ],
  tailoredElevatorPitch: "Results-oriented C#/.NET Developer with 5+ years of building scalable enterprise systems. Proven ability to bridge legacy databases like Oracle with modern backend APIs."
};

const MAX_FILE_SIZE_MB= 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt')) {
    return await file.text();
  }

  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    return value.trim();
  }

  if (name.endsWith('.pdf')) {
    const pdfjsLib: any = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ') + '\n';
    }
    return text.trim();
  }

  throw new Error('Unsupported file type.');
}

export default function App() {
  // Mode tabs: 'paste' | 'upload'
  const [cvMode, setCvMode] = useState<'paste' | 'upload'>('paste');
  const [jdMode, setJdMode] = useState<'paste' | 'upload'>('paste');

  // Input states
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [cvFileParsing, setCvFileParsing] = useState(false);
  const [jdFileParsing, setJdFileParsing] = useState(false);

  // App UI states
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(SAMPLE_RESULT);
  const [isSample, setIsSample] = useState(true);

  // Authentication state. Feature restrictions will be added later.
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authStep, setAuthStep] = useState<'email' | 'code'>('email');
  const [emailAddress, setEmailAddress] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, { credentials: 'include' });
        if (response.ok) setUser(await response.json());
      } catch {
        // The API may not be running while a frontend developer is working.
      }
    };
    void loadCurrentUser();
  }, []);

  const openSignIn = () => {
    setAuthStep('email');
    setVerificationCode('');
    setAuthError('');
    setAuthMessage('');
    setIsAuthOpen(true);
  };

  const requestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/request-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_address: emailAddress }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to create a verification code.');
      setAuthMessage(data.message);
      setAuthStep('code');
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Unable to request a verification code.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const verifyLoginCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsAuthLoading(true);
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email_address: emailAddress, code: verificationCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Unable to verify the code.');
      setUser(data);
      setIsAuthOpen(false);
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Unable to verify the code.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } finally {
      setUser(null);
    }
  };

  // File upload handlers
  const handleCvFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE_BYTES) {
    alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a file under ${MAX_FILE_SIZE_MB} MB.`);
    e.target.value = '';   // reset the input so the same oversized file can be re-selected after a fix
    return;
  }

  setCvFile(file);
  setCvFileParsing(true);
  try {
    const text = await extractTextFromFile(file);
    setCvText(text);
  } catch (err: any) {
    alert(err.message);
    setCvFile(null);
  } finally {
    setCvFileParsing(false);
  }
}; 

  const handleJdFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_FILE_SIZE_BYTES) {
  alert(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a file under ${MAX_FILE_SIZE_MB} MB.`);
  e.target.value = '';
  return;
}
  setJdFile(file);
  setJdFileParsing(true);
  try {
    const text = await extractTextFromFile(file);
    setJdText(text);
  } catch (err: any) {
    alert(err.message);
    setJdFile(null);
  } finally {
    setJdFileParsing(false);
  }
}; 

  // Analyze using gpt-5-mini
  const handleAnalyze = async () => {
  if (!cvText.trim() || !jdText.trim()) {
    alert('Please enter or paste text in both the CV and Job Description fields first!');
    return;
  }

  const previousResult = result;
  const previousIsSample = isSample; 

  setIsLoading(true);
  setResult(null);

  try {
    const response = await fetch(`${API_URL}/api/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
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
    setIsSample(false);
  } catch (error: any) {
    console.error('Error matching skills:', error);
    alert(`Failed to analyze: ${error.message}`);
    setResult(previousResult);
    setIsSample(previousIsSample);
  } finally {
    setIsLoading(false);
  }
  };


  // Check if inputs are ready
  const isCvReady = cvMode === 'paste' ? cvText.trim().length > 0 : cvFile !== null && !cvFileParsing;
  const isJdReady = jdMode === 'paste' ? jdText.trim().length > 0 : jdFile !== null && !jdFileParsing;

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '2rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '1.5rem' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', minHeight: '2rem' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}>
              <span
                title={user.email_address}
                aria-label={`Signed in as ${user.email_address}`}
                style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: avatarColor(user.email_address), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem' }}
              >
                {user.email_address.charAt(0).toUpperCase()}
              </span>
              <button onClick={logout} style={{ padding: '0.35rem 0.65rem', border: '1px solid #0066cc', borderRadius: '4px', background: '#fff', color: '#0066cc', cursor: 'pointer' }}>Sign out</button>
            </div>
          ) : (
            <button onClick={openSignIn} style={{ padding: '0.4rem 0.8rem', border: 'none', borderRadius: '4px', background: '#0066cc', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Sign in</button>
          )}
        </div>
        <div>
          <h1 style={{
    margin: 0,
    fontSize: '2.75rem',
    lineHeight: 1.4,          
    padding: '0.5rem 0',
    fontWeight: 800,
    background: 'linear-gradient(90deg, #7b2ff7 0%, #d6249f 60%, #e5335c 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    letterSpacing: '-0.02em',
  }}>Smart CV Matcher</h1>
          <p style={{ margin: '0.5rem 0 0', color: '#1a1a1a', fontWeight: 700, fontSize: '1.1rem' }}>
  AI-powered CV matching that boosts your job search.
</p>
        </div>
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
                {cvFileParsing ? `⏳ Reading ${cvFile?.name}...` : cvFile ? `✅ ${cvFile.name}` : '📁 Click to upload CV (.pdf, .docx, .txt)'}
              </label>
              <div style = {{fontSize: '0.75rem', color: '#999', marginTop: '0.4rem' }}>Max {MAX_FILE_SIZE_MB} MB</div>
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
                {jdFileParsing ? `⏳ Reading ${jdFile?.name}...` : jdFile ? `✅ ${jdFile.name}` : '📁 Click to upload JD (.pdf, .docx, .txt)'}
              </label>
              <div style = {{fontSize: '0.75rem', color: '#999', marginTop: '0.4rem' }}>Max {MAX_FILE_SIZE_MB} MB</div>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button
          onClick={handleAnalyze}
          disabled={isLoading || !isCvReady || !isJdReady}
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
          {isLoading ? (
          <>
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                border: '2.5px solid rgba(255,255,255,0.4)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginRight: '0.6rem',
                verticalAlign: 'middle',
              }}
            />
            Analyzing...
          </>
        ) : (
          'Analyze Matching Score'
        )}
        </button>
      </div>

      {/* Results Dashboard Section */}
      {result && (
        <div style={{ marginTop: '2.5rem', padding: '1.5rem', border: '2px solid #0066cc', borderRadius: '8px', backgroundColor: '#f8fbff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Matching Results
              {isSample && (
                <span style = {{marginLeft: '0.6rem', fontSize: '0.75rem', fontWeight: 600, color: '#0066cc', backgroundColor: '#eaf2fc', padding: '0.15rem 0.5rem', borderRadius: '4px', verticalAlign: 'middle'}}>
                  SAMPLE
                </span>
              )}
            </h2>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0066cc' }}>
              Overall Score: {result.matchPercentage}%
            </span>
          </div>

          {/* Multi-Dimension Scores */}
          {result.dimensionScores && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.25rem' }}>
              <div style={{ backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #e0e0e0'}}>
                <div style={{ fontSize: '0.85rem', color:'#666'}}>Hard Skills (50%)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#2e7d32'}}>{result.dimensionScores.hardSkillsScore ?? 0}%</div>
              </div>
            
            <div style={{backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #e0e0e0'}}>
              <div style={{fontSize: '0.85rem', color:'#666'}}>Experience Fit (30%)</div>
              <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#0066cc'}}>{result.dimensionScores.experienceScore ?? 0}%</div>
              </div>
            
            <div style={{backgroundColor: '#fff', padding: '0.75rem', borderRadius: '6px', textAlign: 'center', border: '1px solid #e0e0e0'}}>
              <div style={{fontSize: '0.85rem', color:'#666'}}>Soft Skills (20%)</div>
              <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: '#7b2ff7' }}>{result.dimensionScores.transferableSkillsScore ?? 0}%</div>
              </div>
            </div>
          )}

          <p style={{ marginTop: '1rem', fontSize: '1.05rem', color: '#333', lineHeight:1.5 }}>
            {result.candidateSummary}
          </p>

          {/*AI Semantic Inference Content */}
          {result.semanticInferences && result.semanticInferences.length > 0 && (
            <div style={{marginTop: '1rem', padding: '0.85rem 1rem', backgroundColor: '#f0f4f9', borderRadius: '6px', borderLeft: '4px solid #7b2ff7' }}>
              <strong style={{color: '#7b2ff7', fontSize: '0.9rem'}}>AI Semantic Inferences:</strong>
              <ul style={{margin: '0.5rem 0 0', paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#444'}}>
                {result.semanticInferences.map((inf, i) => (
                  <li key={i}>{inf}
                  </li>
                ))}
              </ul>
              </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ color: '#2e7d32', marginTop: 0 }}>Key Match Strengths</h3>
              <ul>
                {result.strengths.map((s, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{s}</li>)}
              </ul>
            </div>

            <div style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <h3 style={{ color: '#c62828', marginTop: 0 }}>Missing Skills</h3>
              <ul>
                {result.missingSkills.map((m, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{m}</li>)}
              </ul>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#ffffff', borderLeft: '4px solid #0066cc', borderRadius: '4px' }}>
            <strong style={{ color: '#0066cc' }}>Recommended Optimization:</strong>
            <p style={{ margin: '0.5rem 0 0', fontStyle: 'italic' }}>"{result.tailoredElevatorPitch}"</p>
          </div>
        </div>
      )}
      

      {/* Feature 3: 3-Step User Guideline Section */}
      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '3.5rem 0 2rem' }} />

      <div style = {{backgroundColor: '#dceafb', borderRadius: '10px', padding: '1.75rem 1.5rem'}}>
        <h3 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#333' }}>How It Works</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          
          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              1
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Add Your Files</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Provide your CV and target Job Description by pasting text or uploading files.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              2
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>One Click</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
             Click the "Analyze Matching Score" button, analysis usually takes under 30 seconds.
            </p>
          </div>

          <div style={{ textAlign: 'center', padding: '1.25rem', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#0066cc', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
              3
            </div>
            <h4 style={{ margin: '0 0 0.5rem' }}>Check Matching Results</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
              Check your overall match score, key strengths, and missing skills.
            </p>
          </div>

        </div>
      </div>

      {isAuthOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="sign-in-title" style={{ position: 'fixed', inset: 0, zIndex: 10, background: 'rgba(0, 0, 0, 0.45)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#fff', color: '#222', borderRadius: '10px', padding: '1.5rem', textAlign: 'left', boxShadow: '0 12px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
              <div>
                <h2 id="sign-in-title" style={{ margin: 0, fontSize: '1.4rem' }}>Sign in</h2>
                <p style={{ marginTop: '0.45rem', color: '#555', fontSize: '0.9rem' }}>Use your email address—no password needed.</p>
              </div>
              <button onClick={() => setIsAuthOpen(false)} aria-label="Close sign-in" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.3rem', color: '#555' }}>×</button>
            </div>

            {authStep === 'email' ? (
              <form onSubmit={requestCode}>
                <label htmlFor="login-email" style={{ display: 'block', marginTop: '1rem', marginBottom: '0.35rem', fontWeight: 600 }}>Email address</label>
                <input id="login-email" type="email" required autoComplete="email" value={emailAddress} onChange={(event) => setEmailAddress(event.target.value)} placeholder="you@example.com" style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem', border: '1px solid #bbb', borderRadius: '4px' }} />
                {authError && <p role="alert" style={{ color: '#c62828', fontSize: '0.9rem' }}>{authError}</p>}
                <button type="submit" disabled={isAuthLoading} style={{ width: '100%', marginTop: '1rem', padding: '0.7rem', border: 'none', borderRadius: '4px', background: '#0066cc', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  {isAuthLoading ? 'Creating code...' : 'Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyLoginCode}>
                <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.9rem' }}>{authMessage}</p>
                <label htmlFor="verification-code" style={{ display: 'block', marginBottom: '0.35rem', fontWeight: 600 }}>Six-digit verification code</label>
                <input id="verification-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} placeholder="123456" style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem', border: '1px solid #bbb', borderRadius: '4px', letterSpacing: '0.2em' }} />
                {authError && <p role="alert" style={{ color: '#c62828', fontSize: '0.9rem' }}>{authError}</p>}
                <button type="submit" disabled={isAuthLoading} style={{ width: '100%', marginTop: '1rem', padding: '0.7rem', border: 'none', borderRadius: '4px', background: '#0066cc', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                  {isAuthLoading ? 'Signing in...' : 'Verify and sign in'}
                </button>
                <button type="button" onClick={() => { setAuthStep('email'); setAuthError(''); }} style={{ width: '100%', marginTop: '0.6rem', padding: '0.6rem', border: 'none', background: 'transparent', color: '#0066cc', cursor: 'pointer' }}>Use a different email</button>
              </form>
            )}
          </div>
        </div>
      )}
      </div> 
  );
}
