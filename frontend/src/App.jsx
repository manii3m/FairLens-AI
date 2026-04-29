import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UploadCloud, 
  BarChart3, 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight,
  Database,
  Activity,
  FileText,
  Sparkles,
  Layers
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const API_URL = "http://localhost:8000";

// Animation Variants
const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const pageSlide = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
};

function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [error, setError] = useState("");
  
  const [datasetId, setDatasetId] = useState(null);
  const [summary, setSummary] = useState(null);
  
  const [targetColumn, setTargetColumn] = useState("");
  const [sensitiveColumn, setSensitiveColumn] = useState("");
  const [favorableLabel, setFavorableLabel] = useState("");
  const [features, setFeatures] = useState([]);
  
  const [analysisResult, setAnalysisResult] = useState(null);
  const [mitigationResult, setMitigationResult] = useState(null);

  // Mouse position for subtle glass effects
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setLoadingText("Uploading dataset securely...");
    setError("");
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      setSummary(res.data);
      setDatasetId(res.data.dataset_id);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.detail || "Upload failed");
    }
    setLoading(false);
  };

  const handleAnalyze = async () => {
    if (!targetColumn || !sensitiveColumn || !favorableLabel) {
      setError("Please fill all required fields");
      return;
    }
    
    setLoading(true);
    setLoadingText("Running fairness algorithms & querying LLM...");
    setError("");
    try {
      const res = await axios.post(`${API_URL}/analyze`, {
        dataset_id: datasetId,
        target_column: targetColumn,
        sensitive_column: sensitiveColumn,
        favorable_label: favorableLabel
      });
      setAnalysisResult(res.data);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.detail || "Analysis failed");
    }
    setLoading(false);
  };

  const handleMitigate = async () => {
    if (features.length === 0) {
      setError("Please select at least one feature for the model");
      return;
    }
    
    setLoading(true);
    setLoadingText("Applying Correlation Removal & retraining model...");
    setError("");
    try {
      const res = await axios.post(`${API_URL}/mitigate`, {
        dataset_id: datasetId,
        target_column: targetColumn,
        sensitive_column: sensitiveColumn,
        features: features
      });
      setMitigationResult(res.data);
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.detail || "Mitigation failed");
    }
    setLoading(false);
  };

  const toggleFeature = (col) => {
    if (features.includes(col)) {
      setFeatures(features.filter(f => f !== col));
    } else {
      setFeatures([...features, col]);
    }
  };

  const renderDistributionChart = () => {
    if (!analysisResult) return null;
    const data = Object.keys(analysisResult.distribution).map(key => ({
      group: key,
      approvalRate: analysisResult.distribution[key].approval_rate * 100
    }));
    
    return (
      <div className="h-64 mt-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="group" stroke="#94a3b8" tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              contentStyle={{ backgroundColor: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              itemStyle={{ color: '#00F2FE' }}
            />
            <Bar dataKey="approvalRate" fill="url(#colorGradient)" radius={[6, 6, 0, 0]} barSize={40} />
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00F2FE" />
                <stop offset="100%" stopColor="#4FACFE" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative overflow-hidden font-sans">
      
      {/* Background Animated Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-primary/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-secondary/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10 p-4 md:p-8 max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Sticky Navbar */}
        <motion.header 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="sticky top-4 z-50 flex items-center justify-between border border-white/10 bg-black/40 backdrop-blur-xl px-6 py-4 rounded-2xl shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-primary to-secondary p-2 rounded-xl text-darker shadow-[0_0_15px_rgba(0,242,254,0.4)]">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white font-display">FairLens <span className="text-primary">AI</span></h1>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-400 font-medium">
            {[1, 2, 3, 4].map((s, idx) => (
              <React.Fragment key={s}>
                <div className={`px-4 py-1.5 rounded-full transition-all duration-500 ${step >= s ? 'bg-white/10 text-white border border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'bg-transparent border border-transparent'}`}>
                  {s}. {['Upload', 'Configure', 'Analyze', 'Mitigate'][s-1]}
                </div>
                {idx < 3 && <div className={`h-0.5 w-6 rounded-full transition-all duration-500 ${step > s ? 'bg-primary' : 'bg-white/10'}`}></div>}
              </React.Fragment>
            ))}
          </div>
        </motion.header>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center gap-3 backdrop-blur-md"
            >
              <AlertTriangle size={20} />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Loading Overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 border-4 border-white/10 border-t-primary rounded-full animate-spin"></div>
                <p className="text-white font-medium animate-pulse">{loadingText}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area with Page Transitions */}
        <main className="mt-8 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            
            {/* Step 1: Upload (Hero Style) */}
            {step === 1 && (
              <motion.div 
                key="step1" variants={pageSlide} initial="initial" animate="animate" exit="exit"
                className="flex flex-col items-center justify-center min-h-[60vh] text-center"
              >
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.8, type: "spring" }}
                  className="w-32 h-32 mb-8 relative flex items-center justify-center"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-secondary to-primary rounded-full blur-[40px] opacity-40 animate-pulse-slow"></div>
                  <div className="relative bg-black/40 border border-white/20 p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
                    <ShieldCheck size={48} className="text-primary" />
                  </div>
                </motion.div>

                <motion.h2 variants={fadeIn} className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                  Uncover & Fix Bias in your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">AI Models.</span>
                </motion.h2>
                <motion.p variants={fadeIn} className="text-lg text-slate-400 mb-10 max-w-2xl">
                  Upload your dataset or predictions. Our advanced fairness engine instantly detects disparities, explains them in plain English, and mitigates bias without sacrificing accuracy.
                </motion.p>
                
                <motion.div variants={fadeIn}>
                  <label className="btn-primary cursor-pointer text-lg px-8 py-4">
                    <UploadCloud size={24} />
                    {loading ? "Initializing..." : "Upload Dataset to Begin"}
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={loading} />
                  </label>
                  <p className="text-sm text-slate-500 mt-6">Supports .CSV files (e.g. Adult Income, COMPAS)</p>
                </motion.div>
              </motion.div>
            )}

            {/* Step 2: Configuration */}
            {step === 2 && summary && (
              <motion.div key="step2" variants={pageSlide} initial="initial" animate="animate" exit="exit" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <motion.div variants={fadeIn} className="lg:col-span-1 flex flex-col gap-6">
                  <div className="card h-full">
                    <div className="flex items-center gap-3 text-white mb-6 border-b border-white/10 pb-4">
                      <div className="p-2 bg-white/5 rounded-lg"><Database size={20} className="text-secondary" /></div>
                      <h3 className="font-semibold text-lg">Dataset Topology</h3>
                    </div>
                    <div className="space-y-4 text-sm text-slate-300">
                      <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-slate-400">Total Records</span>
                        <span className="font-mono text-white text-lg">{summary.rows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-slate-400">Features</span>
                        <span className="font-mono text-white text-lg">{summary.columns}</span>
                      </div>
                      <div className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                        <span className="text-slate-400">Filename</span>
                        <span className="truncate max-w-[120px] text-primary">{summary.filename}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div variants={fadeIn} className="lg:col-span-2 card">
                  <div className="flex items-center gap-3 text-white mb-8 border-b border-white/10 pb-4">
                    <div className="p-2 bg-white/5 rounded-lg"><Activity size={20} className="text-primary" /></div>
                    <h3 className="font-semibold text-lg">Analysis Configuration</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Target Variable</label>
                      <select className="input-field" value={targetColumn} onChange={(e) => setTargetColumn(e.target.value)}>
                        <option value="">Select Target...</option>
                        {summary.column_names.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                      <p className="text-xs text-slate-500">The outcome you are predicting (e.g., Loan_Status)</p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Favorable Label</label>
                      <input type="text" className="input-field" value={favorableLabel} onChange={(e) => setFavorableLabel(e.target.value)} placeholder="e.g., 1 or 'Approved'" />
                      <p className="text-xs text-slate-500">The positive outcome value</p>
                    </div>
                    
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-sm font-medium text-slate-300">Sensitive Attribute</label>
                      <select className="input-field border-primary/30 bg-primary/5 focus:ring-primary" value={sensitiveColumn} onChange={(e) => setSensitiveColumn(e.target.value)}>
                        <option value="">Select Sensitive Attribute...</option>
                        {summary.column_names.map(col => <option key={col} value={col}>{col}</option>)}
                      </select>
                      <p className="text-xs text-slate-500">The protected class to check for bias (e.g., Gender, Race, Age)</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <button onClick={handleAnalyze} className="btn-primary">
                      Run Bias Detection <ArrowRight size={18} />
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Step 3: Analysis Results */}
            {step >= 3 && analysisResult && (
              <motion.div key="step3" variants={staggerContainer} initial="hidden" animate="visible" exit="exit" className="flex flex-col gap-6">
                
                <motion.div variants={fadeIn} className="flex items-center justify-between mb-2">
                  <h2 className="text-3xl font-bold text-white flex items-center gap-3 font-display">
                    <BarChart3 className="text-primary" size={32} /> Bias Analysis Report
                  </h2>
                </motion.div>
                
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <motion.div variants={fadeIn} className="card border-t-4 border-t-primary bg-gradient-to-b from-primary/5 to-transparent">
                    <p className="text-slate-400 text-sm mb-2 font-medium">Fairness Score</p>
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-display font-bold text-white">{analysisResult.metrics.bias_score}</span>
                      <span className="text-lg text-slate-500 mb-1">/ 100</span>
                    </div>
                  </motion.div>
                  
                  <motion.div variants={fadeIn} className="card">
                    <p className="text-slate-400 text-sm mb-2 font-medium">Disparate Impact Ratio</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-display font-bold text-white">{analysisResult.metrics.disparate_impact_ratio}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Ideal threshold is ~1.0</p>
                  </motion.div>
                  
                  <motion.div variants={fadeIn} className={`card border-t-4 bg-gradient-to-b to-transparent ${
                    analysisResult.metrics.risk_level === 'High' ? 'border-t-red-500 from-red-500/5' :
                    analysisResult.metrics.risk_level === 'Medium' ? 'border-t-yellow-500 from-yellow-500/5' : 'border-t-green-500 from-green-500/5'
                  }`}>
                    <p className="text-slate-400 text-sm mb-2 font-medium">Risk Level</p>
                    <div className="flex items-end gap-2">
                      <span className={`text-4xl font-display font-bold ${
                        analysisResult.metrics.risk_level === 'High' ? 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' :
                        analysisResult.metrics.risk_level === 'Medium' ? 'text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'text-green-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                      }`}>{analysisResult.metrics.risk_level}</span>
                    </div>
                  </motion.div>
                </div>

                {/* Explainability & Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <motion.div variants={fadeIn} className="card flex flex-col justify-between">
                    <div>
                      <h3 className="font-semibold text-lg text-white mb-6 flex items-center gap-2">
                        <Sparkles size={20} className="text-secondary" /> AI Insights
                      </h3>
                      <div className="bg-gradient-to-br from-white/5 to-transparent p-6 rounded-xl border border-white/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[30px] -mr-10 -mt-10 transition-transform duration-700 group-hover:scale-150"></div>
                        <p className="text-lg text-slate-200 leading-relaxed relative z-10 font-medium">
                          {analysisResult.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5">
                      <h4 className="font-semibold text-white mb-3">Feature Selection for Mitigation</h4>
                      <p className="text-sm text-slate-400 mb-4">Select the features to train the debiased model.</p>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {summary?.column_names
                          .filter(c => c !== targetColumn && c !== sensitiveColumn)
                          .map(col => (
                            <button 
                              key={col} onClick={() => toggleFeature(col)}
                              className={`px-4 py-2 text-sm rounded-lg border transition-all duration-300 ${
                                features.includes(col) 
                                  ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(0,242,254,0.2)]' 
                                  : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/30 hover:bg-white/5'
                              }`}
                            >
                              {col}
                            </button>
                        ))}
                      </div>
                      
                      {step === 3 && (
                        <button onClick={handleMitigate} disabled={features.length === 0} className="btn-primary w-full mt-8">
                          <ShieldCheck size={20} /> Train & Apply Mitigation
                        </button>
                      )}
                    </div>
                  </motion.div>

                  <motion.div variants={fadeIn} className="card flex flex-col">
                    <h3 className="font-semibold text-lg text-white mb-2 flex items-center gap-2">
                      <BarChart3 size={20} className="text-primary" /> Outcome Distribution
                    </h3>
                    <p className="text-sm text-slate-400 mb-2">Rate of favorable outcomes across '{sensitiveColumn}'</p>
                    {renderDistributionChart()}
                  </motion.div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Mitigation Results */}
            {step >= 4 && mitigationResult && (
              <motion.div key="step4" variants={pageSlide} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-6 mt-4">
                <div className="card bg-gradient-to-br from-black/80 to-slate-900/80 border-primary/30 shadow-[0_0_50px_rgba(0,242,254,0.05)]">
                  <div className="flex items-center justify-between mb-10 border-b border-white/10 pb-6">
                    <div>
                      <h3 className="text-2xl font-display font-bold text-white flex items-center gap-3">
                        <ShieldCheck className="text-green-400" /> Mitigation Successful
                      </h3>
                      <p className="text-slate-400 mt-2">Applied Algorithm: <span className="text-primary bg-primary/10 px-2 py-1 rounded font-mono text-sm">{mitigationResult.technique}</span></p>
                    </div>
                    <button className="btn-secondary">
                      <FileText size={18} /> Export Report
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    
                    {/* VS Badge */}
                    <div className="hidden md:flex absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 bg-black rounded-full border border-white/10 items-center justify-center text-slate-400 font-bold z-10 shadow-2xl backdrop-blur-xl">
                      VS
                    </div>

                    {/* Before Card */}
                    <div className="bg-black/40 p-8 rounded-2xl border border-white/5 relative">
                      <div className="absolute top-0 right-0 bg-slate-800 text-slate-300 text-xs px-4 py-1.5 rounded-bl-xl rounded-tr-xl font-medium tracking-wider">BASELINE MODEL</div>
                      <h4 className="text-xl font-display font-semibold text-white mb-8">Before Mitigation</h4>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between mb-2">
                            <p className="text-sm text-slate-400 font-medium">Model Accuracy</p>
                            <p className="text-sm text-white font-mono">{(mitigationResult.before.accuracy * 100).toFixed(1)}%</p>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${mitigationResult.before.accuracy * 100}%` }} transition={{ duration: 1, delay: 0.5 }} className="bg-slate-400 h-full rounded-full"></motion.div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <p className="text-sm text-slate-400 font-medium">Demographic Parity Diff (Bias)</p>
                            <p className="text-sm text-red-400 font-mono font-medium">{mitigationResult.before.demographic_parity_difference.toFixed(3)}</p>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, mitigationResult.before.demographic_parity_difference * 100)}%` }} transition={{ duration: 1, delay: 0.7 }} className="bg-red-500 h-full rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)]"></motion.div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* After Card */}
                    <div className="bg-gradient-to-br from-primary/10 to-transparent p-8 rounded-2xl border border-primary/20 relative">
                      <div className="absolute top-0 right-0 bg-primary/20 text-primary text-xs px-4 py-1.5 rounded-bl-xl rounded-tr-xl font-medium tracking-wider border-l border-b border-primary/20">DEBIASED MODEL</div>
                      <h4 className="text-xl font-display font-semibold text-white mb-8">After Mitigation</h4>
                      <div className="space-y-6">
                        <div>
                          <div className="flex justify-between mb-2">
                            <p className="text-sm text-slate-400 font-medium">Model Accuracy</p>
                            <p className="text-sm text-white font-mono">{(mitigationResult.after.accuracy * 100).toFixed(1)}%</p>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${mitigationResult.after.accuracy * 100}%` }} transition={{ duration: 1, delay: 0.5 }} className="bg-primary h-full rounded-full shadow-[0_0_10px_rgba(0,242,254,0.8)]"></motion.div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between mb-2">
                            <p className="text-sm text-slate-400 font-medium">Demographic Parity Diff (Bias)</p>
                            <p className="text-sm text-green-400 font-mono font-medium">{mitigationResult.after.demographic_parity_difference.toFixed(3)}</p>
                          </div>
                          <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, mitigationResult.after.demographic_parity_difference * 100)}%` }} transition={{ duration: 1, delay: 0.7 }} className="bg-green-500 h-full rounded-full shadow-[0_0_10px_rgba(34,197,94,0.8)]"></motion.div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }} className="mt-8 p-5 bg-black/30 rounded-xl border border-white/5 text-sm text-slate-300 text-center backdrop-blur-sm">
                    <span className="font-semibold text-white">Trade-off Analysis:</span> Bias reduced by a significant margin while maintaining structural model accuracy. The deployed model is now aligned with fairness parameters.
                  </motion.div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

export default App;
