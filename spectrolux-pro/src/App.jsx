import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Upload,
    Leaf,
    Activity,
    CheckCircle2,
    AlertCircle,
    ChevronRight,
    TrendingUp,
    MapPin,
    Clock,
    Download,
    FileSpreadsheet,
    Info,
    Layers,
    Zap,
    ShieldCheck,
    Target,
    BarChart3,
    Waves,
    Sparkles,
    Search,
    Navigation,
    Globe,
    Cpu,
    Microscope
} from 'lucide-react';
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    AreaChart,
    Area,
    ComposedChart,
    Line,
    Bar,
    Legend,
    PieChart,
    Pie,
    Cell
} from 'recharts';

/**
 * SPECTROLUX PRO: ENTERPRISE AGRITECH INTELLIGENCE
 * Implementation of Multi-Module Views (Analysis, Insights, Mapping)
 */

const App = () => {
    const [data, setData] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);
    const [selectedMeasurement, setSelectedMeasurement] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fileMode, setFileMode] = useState('spectral');
    const [activeTab, setActiveTab] = useState('analysis');

    const loadSheetJS = () => {
        return new Promise((resolve) => {
            if (window.XLSX) return resolve(window.XLSX);
            const script = document.createElement('script');
            script.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
            script.onload = () => resolve(window.XLSX);
            document.head.appendChild(script);
        });
    };

    const parseCSV = (text) => {
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) return null;
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).filter(line => line.trim() !== '').map(line => {
            const values = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) {
                    values.push(current.trim().replace(/^"|"$/g, ''));
                    current = '';
                } else current += char;
            }
            values.push(current.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((header, i) => { if (header) obj[header] = values[i]; });
            return obj;
        });
        return rows;
    };

    const processFile = async (file) => {
        setLoading(true);
        setError(null);
        const fileName = file.name.toLowerCase();
        const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                let rows = [];
                if (isExcel) {
                    const XLSX = await loadSheetJS();
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
                } else {
                    rows = parseCSV(event.target.result);
                }

                if (!rows || rows.length === 0) throw new Error("Invalid file content.");

                const allKeys = Object.keys(rows[0]);
                const wavelengthKeys = allKeys.filter(k => !isNaN(parseFloat(k)) && /^[0-9]/.test(k.toString().trim()));

                if (wavelengthKeys.length === 0) {
                    const hasResultCol = allKeys.some(k => ['Value', 'CCI', 'Chlorophyll'].includes(k));
                    if (hasResultCol) {
                        setFileMode('results');
                        setData(rows.filter(r => r['Value'] || r['CCI']).map((row, idx) => ({
                            id: row['Measurement ID'] || row['ID'] || `SCAN-${idx + 101}`,
                            timestamp: row['Timestamp'] || new Date().toISOString().split('T')[0],
                            gps: row['GPS Location'] || '40.7128° N, 74.0060° W',
                            cci: parseFloat(row['Value'] || row['CCI'] || 0).toFixed(2),
                            val931: "N/A", val653: "N/A", curve: [], isResultsOnly: true, raw: row
                        })));
                        return;
                    }
                    throw new Error("No spectral signatures detected in data.");
                }

                setFileMode('spectral');
                const key931 = wavelengthKeys.reduce((prev, curr) => Math.abs(parseFloat(curr) - 931) < Math.abs(parseFloat(prev) - 931) ? curr : prev);
                const key653 = wavelengthKeys.reduce((prev, curr) => Math.abs(parseFloat(curr) - 653) < Math.abs(parseFloat(prev) - 653) ? curr : prev);

                setData(rows.map((row, idx) => {
                    const t931 = parseFloat(row[key931]);
                    const t653 = parseFloat(row[key653]);
                    const cci = t653 !== 0 ? (t931 / t653) : 0;
                    return {
                        id: row['Measurement ID'] || `SCAN-${idx + 101}`,
                        timestamp: row['Timestamp'] || new Date().toISOString().split('T')[0],
                        gps: row['GPS Location'] || '40.7128° N, 74.0060° W',
                        cci: cci.toFixed(2),
                        val931: t931.toFixed(3),
                        val653: t653.toFixed(3),
                        curve: wavelengthKeys.map(k => ({ wavelength: parseFloat(k), value: parseFloat(row[k]) || 0 })).sort((a, b) => a.wavelength - b.wavelength),
                        key931, key653, isResultsOnly: false, raw: row
                    };
                }));
            } catch (err) { setError(err.message); } finally { setLoading(false); }
        };
        isExcel ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (file) processFile(file);
    };

    const activeData = useMemo(() => data ? data[selectedMeasurement] : null, [data, selectedMeasurement]);

    const getHealthScore = (cci) => {
        const val = parseFloat(cci);
        if (val > 35) return { label: 'Optimal', color: 'text-emerald-700', bg: 'bg-emerald-100', score: 98, nitrogen: 'Standard' };
        if (val > 20) return { label: 'Robust', color: 'text-green-700', bg: 'bg-green-100', score: 85, nitrogen: 'Low Priority' };
        if (val > 10) return { label: 'Mild Stress', color: 'text-amber-700', bg: 'bg-amber-100', score: 62, nitrogen: 'Top-Dress Recommended' };
        return { label: 'Deficient', color: 'text-rose-700', bg: 'bg-rose-100', score: 34, nitrogen: 'Critical Application Needed' };
    };

    // Mock global trend data for Insights tab
    const trendData = useMemo(() => {
        if (!data) return [];
        return data.map((d, i) => ({
            name: d.id.split('-')[1] || i,
            cci: parseFloat(d.cci),
            biomass: (parseFloat(d.cci) * 0.85).toFixed(1),
            yield: (parseFloat(d.cci) * 0.12).toFixed(1)
        }));
    }, [data]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-600 font-sans selection:bg-emerald-600/30 overflow-hidden flex flex-col">
            {/* Premium Header */}
            <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-xl flex items-center justify-between px-6 z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-emerald-300 rounded-lg flex items-center justify-center shadow-md">
                        <Leaf className="text-white w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-slate-900 font-bold tracking-tight text-sm uppercase">AC-<span className="text-emerald-700">PSS</span></h1>
                        <div className="flex items-center gap-1.5 opacity-50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span className="text-[9px] font-black uppercase tracking-widest">Advance Centre for Plant & Soil Science</span>
                        </div>
                    </div>
                </div>

                {data && (
                    <div className="hidden md:flex items-center bg-slate-50 rounded-full px-1.5 py-1.5 border border-slate-200 gap-1">
                        {[
                            { id: 'analysis', icon: Microscope, label: 'Analysis' },
                            { id: 'insights', icon: BarChart3, label: 'Insights' },
                            { id: 'mapping', icon: Navigation, label: 'Mapping' }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                <tab.icon size={12} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-3">
                    <button className="p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-900"><Search size={18} /></button>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-b from-emerald-600 to-emerald-700 border border-slate-200 flex items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-colors">
                        <span className="text-[10px] font-bold text-white uppercase">AC</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
                {/* Modern Sidebar */}
                <aside className="w-72 bg-white border-r border-slate-200 flex flex-col p-6 gap-8 shrink-0">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Deployment Zone</label>
                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 group cursor-pointer hover:bg-slate-100 transition-all">
                                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center group-hover:bg-emerald-600/20 group-hover:text-emerald-700 transition-colors">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-900">North Field 02</p>
                                    <p className="text-[10px] text-emerald-700 font-medium">Remote Sync Active</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between px-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Live Queue</label>
                                <span className="text-[10px] bg-slate-100 text-slate-900 px-2 py-0.5 rounded-full font-bold">{data ? data.length : 0}</span>
                            </div>

                            <div className="space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                                {!data ? (
                                    <div className="py-12 text-center opacity-30 flex flex-col items-center gap-4">
                                        <Cpu size={32} />
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed">Processor Idle<br />Ingest file to start</p>
                                    </div>
                                ) : (
                                    data.map((item, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setSelectedMeasurement(idx)}
                                            className={`w-full group p-3 rounded-2xl transition-all text-left border relative overflow-hidden ${selectedMeasurement === idx
                                                ? 'bg-emerald-100 border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-lg'
                                                : 'bg-slate-50 border-transparent hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className="relative z-10 flex justify-between items-start">
                                                <div className="min-w-0">
                                                    <p className={`text-[11px] font-black truncate tracking-tight ${selectedMeasurement === idx ? 'text-emerald-700' : 'text-slate-600'}`}>{item.id}</p>
                                                    <p className="text-[9px] opacity-40 font-bold mt-0.5 uppercase tracking-wider">{item.timestamp}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-[10px] font-black ${selectedMeasurement === idx ? 'text-emerald-700' : 'text-slate-500'}`}>{item.cci}</span>
                                                </div>
                                            </div>
                                            {selectedMeasurement === idx && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-600 shadow-md"></div>}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto space-y-4">
                        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={14} className="text-emerald-700" />
                                <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider">Cloud Tier</span>
                            </div>
                            <div className="h-1 bg-slate-100 rounded-full mb-1"><div className="w-[34%] h-full bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div></div>
                            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">34% Capacity Utilized</p>
                        </div>
                        <button onClick={() => { setData(null); setActiveTab('analysis'); }} className="w-full py-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-900 border border-slate-200">
                            Hard Flush
                        </button>
                    </div>
                </aside>

                {/* Main Workspace */}
                <main className="flex-1 bg-slate-50 relative overflow-y-auto custom-scrollbar flex flex-col">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

                    {!data ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100 blur-[120px] rounded-full"></div>

                            <div
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); }}
                                className={`w-full max-w-xl p-16 rounded-[60px] border border-slate-200 transition-all cursor-pointer group flex flex-col items-center text-center gap-10 backdrop-blur-xl bg-white shadow-2xl ${isDragging ? 'border-emerald-400 bg-emerald-50 scale-[1.03]' : 'hover:bg-slate-100 hover:border-slate-300'
                                    }`}
                                onClick={() => document.getElementById('file-upload').click()}
                            >
                                <div className="w-24 h-24 bg-gradient-to-tr from-emerald-50 to-white rounded-[32px] flex items-center justify-center border border-slate-200 shadow-inner relative group-hover:scale-110 transition-transform duration-500">
                                    <Upload className="w-10 h-10 text-emerald-700 relative z-10" />
                                </div>

                                <div className="space-y-4">
                                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-tight">Advanced Soil & Plant<br />Analysis Engine</h2>
                                    <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed font-medium">
                                        Hyperspectral ingestion of <span className="text-emerald-700 font-black italic">XLSX</span> or <span className="text-emerald-700 font-black italic">CSV</span> signatures.
                                    </p>
                                </div>

                                <input id="file-upload" type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                                <button className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-[0_10px_40px_rgba(0,0,0,0.05)] hover:shadow-black/5 transition-all active:scale-95">
                                    Initiate Upload
                                </button>
                            </div>

                            {loading && <div className="mt-12 flex items-center gap-3 text-emerald-700 text-[11px] font-black uppercase tracking-[0.4em] animate-pulse">
                                <Activity size={18} /> Deep Neural Processing...
                            </div>}

                            {error && (
                                <div className="mt-12 bg-rose-100 border border-rose-500/20 p-5 rounded-3xl flex items-center gap-3 max-w-sm animate-in zoom-in-95">
                                    <AlertCircle className="text-rose-600" size={24} />
                                    <p className="text-xs font-black text-rose-700 leading-tight uppercase tracking-tight">{error}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-8 md:p-12 animate-in fade-in slide-in-from-bottom-10 duration-1000 w-full max-w-7xl mx-auto">
                            {/* ANALYSIS TAB VIEW */}
                            {activeTab === 'analysis' && (
                                <div className="space-y-12">
                                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="px-3 py-1 bg-emerald-100 border border-emerald-200 rounded-full text-[9px] font-black text-emerald-700 uppercase tracking-widest">Spectral Matrix Active</span>
                                            </div>
                                            <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none truncate max-w-lg">{activeData.id}</h1>
                                            <div className="flex items-center gap-6 text-slate-500 text-[11px] font-black uppercase tracking-widest">
                                                <div className="flex items-center gap-2"><MapPin size={14} className="text-emerald-700" /> {activeData.gps}</div>
                                                <div className="flex items-center gap-2"><Clock size={14} /> {activeData.timestamp}</div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="p-6 bg-white border border-slate-200 rounded-[32px] min-w-[180px] shadow-2xl relative overflow-hidden group">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 blur-3xl rounded-full group-hover:bg-emerald-100 transition-all"></div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">CCI Signature</p>
                                                <div className="flex items-end gap-2">
                                                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{activeData.cci}</span>
                                                    <TrendingUp size={24} className="text-emerald-700 mb-2" />
                                                </div>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-200 rounded-[32px] min-w-[180px] shadow-2xl relative overflow-hidden">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-1">Chlorophyll</p>
                                                <div className="h-[90px] w-full relative mt-2">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={[
                                                                    { name: 'Low', value: 1, color: '#f43f5e' },     // rose-500
                                                                    { name: 'Optimal', value: 1, color: '#10b981' }, // emerald-500
                                                                    { name: 'High', value: 1, color: '#38bdf8' }     // sky-400
                                                                ]}
                                                                cx="50%"
                                                                cy="100%"
                                                                startAngle={180}
                                                                endAngle={0}
                                                                innerRadius={50}
                                                                outerRadius={70}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                                stroke="none"
                                                                cornerRadius={4}
                                                            >
                                                                {[
                                                                    { name: 'Low', value: 1, color: '#f43f5e' },
                                                                    { name: 'Optimal', value: 1, color: '#10b981' },
                                                                    { name: 'High', value: 1, color: '#38bdf8' }
                                                                ].map((entry, index) => {
                                                                    const cci = parseFloat(activeData.cci);
                                                                    const isActive = (index === 0 && cci <= 15) || (index === 1 && cci > 15 && cci <= 35) || (index === 2 && cci > 35);
                                                                    return (
                                                                        <Cell
                                                                            key={`cell-${index}`}
                                                                            fill={entry.color}
                                                                            opacity={isActive ? 1 : 0.15}
                                                                            style={{ filter: isActive ? `drop-shadow(0 0 8px ${entry.color})` : 'none', transition: 'all 0.5s ease' }}
                                                                        />
                                                                    );
                                                                })}
                                                            </Pie>
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center justify-end pointer-events-none">
                                                        <span className={`text-xl font-black tracking-tight ${parseFloat(activeData.cci) <= 15 ? 'text-rose-700' : parseFloat(activeData.cci) > 35 ? 'text-sky-600' : 'text-emerald-700'}`}>
                                                            {parseFloat(activeData.cci) <= 15 ? 'LOW' : parseFloat(activeData.cci) > 35 ? 'HIGH' : 'OPTIMAL'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-200 rounded-[32px] min-w-[180px] shadow-2xl">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Health Grade</p>
                                                <div className="text-3xl font-black text-slate-900 tracking-tight">{getHealthScore(activeData.cci).score}%</div>
                                                <div className={`mt-2 text-[10px] font-black uppercase tracking-widest ${getHealthScore(activeData.cci).color}`}>{getHealthScore(activeData.cci).label}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                        <div className="lg:col-span-8 space-y-8">
                                            <div className="bg-white border border-slate-200 rounded-[48px] p-10 shadow-2xl h-[520px] flex flex-col group relative overflow-hidden">
                                                <div className="absolute -top-20 -right-20 w-80 h-80 bg-emerald-600/[0.03] blur-[100px] rounded-full pointer-events-none group-hover:bg-emerald-50 transition-all"></div>

                                                <div className="flex items-center justify-between mb-12 relative z-10">
                                                    <div>
                                                        <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">Spectral Response Analysis</h3>
                                                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Deep Layer Reflectance Profile</p>
                                                    </div>
                                                    <div className="flex gap-8">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></div>
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">NIR Peak</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm"></div>
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Red Valley</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-1 w-full relative z-10">
                                                    {fileMode === 'spectral' ? (
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <AreaChart data={activeData.curve}>
                                                                <defs>
                                                                    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                                    </linearGradient>
                                                                </defs>
                                                                <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                                                <XAxis
                                                                    dataKey="wavelength"
                                                                    stroke="rgba(255,255,255,0.2)"
                                                                    fontSize={10}
                                                                    tickLine={false}
                                                                    axisLine={false}
                                                                    tickFormatter={(v) => `${Math.round(v)}`}
                                                                />
                                                                <YAxis hide domain={[0, 'auto']} />
                                                                <Tooltip
                                                                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.85)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px', backdropFilter: 'blur(20px)', padding: '20px' }}
                                                                    labelStyle={{ color: '#94a3b8', fontSize: '10px', fontWeight: 'black', marginBottom: '8px', textTransform: 'uppercase' }}
                                                                    itemStyle={{ color: '#10b981', fontSize: '14px', fontWeight: 'black' }}
                                                                />
                                                                <Area
                                                                    type="monotone"
                                                                    dataKey="value"
                                                                    stroke="#10b981"
                                                                    strokeWidth={4}
                                                                    fill="url(#glow)"
                                                                    animationDuration={2500}
                                                                    activeDot={{ r: 8, fill: '#fff', stroke: '#10b981', strokeWidth: 4 }}
                                                                />
                                                                <ReferenceLine x={parseFloat(activeData.key931)} stroke="#10b981" strokeDasharray="5 5" />
                                                                <ReferenceLine x={parseFloat(activeData.key653)} stroke="#22d3ee" strokeDasharray="5 5" />
                                                            </AreaChart>
                                                        </ResponsiveContainer>
                                                    ) : (
                                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-60 bg-white/[0.01] rounded-[32px] border border-slate-200">
                                                            <BarChart3 size={64} className="mb-6 text-slate-700" />
                                                            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Results Archive Mode</h3>
                                                            <p className="text-xs text-slate-500 max-w-xs mt-3 font-bold uppercase tracking-widest leading-relaxed">Hyperspectral curves not available for historical imports. Mapping summary values.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-4 space-y-8">
                                            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-[48px] p-10 shadow-2xl flex flex-col justify-between h-[350px] group relative overflow-hidden">
                                                <div className="absolute -bottom-10 -right-10 w-56 h-56 bg-slate-100 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700"></div>
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-8">
                                                        <h3 className="text-[11px] font-black text-white/50 uppercase tracking-[0.3em]">Yield Forecast</h3>
                                                        <Zap className="text-white/30" size={24} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-6xl font-black text-white tracking-tighter leading-none">
                                                            {(parseFloat(activeData.cci) * 1.62).toFixed(1)}
                                                            <span className="text-xl ml-3 opacity-60">t/ha</span>
                                                        </p>
                                                        <div className="flex items-center gap-2 text-white/80 font-black text-xs uppercase tracking-[0.1em]">
                                                            <TrendingUp size={16} /> Projected Harvest Vol.
                                                        </div>
                                                    </div>
                                                </div>
                                                <button className="w-full py-5 bg-white text-slate-900 rounded-[24px] font-black text-[11px] uppercase tracking-widest hover:bg-slate-900 transition-all transform hover:-translate-y-1 shadow-2xl shadow-black/30 relative z-10">
                                                    Optimization Protocol
                                                </button>
                                            </div>

                                            <div className="bg-white border border-slate-200 rounded-[48px] p-10 flex flex-col gap-8 flex-1 min-h-[400px]">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-emerald-700">
                                                        <Cpu size={20} />
                                                    </div>
                                                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">Agronomy Stack</h3>
                                                </div>

                                                <div className="space-y-8 flex-1">
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center px-1">
                                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nitrogen Metabolism</span>
                                                            <span className={`text-[11px] font-black uppercase tracking-tight ${getHealthScore(activeData.cci).color}`}>
                                                                {getHealthScore(activeData.cci).nitrogen}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-200">
                                                            <div
                                                                className={`h-full transition-all duration-1500 bg-current shadow-[0_0_10px_currentColor] ${getHealthScore(activeData.cci).color}`}
                                                                style={{ width: `${getHealthScore(activeData.cci).score}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-5 bg-white border border-slate-200 rounded-3xl">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">NIR Ref.</p>
                                                            <p className="text-lg font-black text-slate-900 tracking-widest">{activeData.val931}</p>
                                                        </div>
                                                        <div className="p-5 bg-white border border-slate-200 rounded-3xl">
                                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Red Valley</p>
                                                            <p className="text-lg font-black text-slate-900 tracking-widest">{activeData.val653}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                                                    <Target size={16} className="text-emerald-700 shrink-0" />
                                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-tight">Derived from CI705 Index Logic (931:653 Ratio).</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* INSIGHTS TAB VIEW */}
                            {activeTab === 'insights' && (
                                <div className="space-y-12">
                                    <header className="space-y-4">
                                        <div className="inline-flex items-center gap-2 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-widest">Enterprise Analytics Engine</div>
                                        <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">Field Correlations</h2>
                                        <p className="text-slate-500 text-sm font-medium tracking-wide max-w-2xl">Comprehensive dataset analysis correlating chlorophyll content with projected biomass and historical yield trends across all active nodes.</p>
                                    </header>

                                    <div className="grid grid-cols-1 gap-12">
                                        <div className="bg-white border border-slate-200 rounded-[48px] p-10 h-[500px]">
                                            <div className="flex items-center justify-between mb-12">
                                                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em]">CCI vs Biomass Projection</h3>
                                                <div className="flex gap-10">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-emerald-700 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500" /> CCI Value</div>
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-cyan-700 uppercase tracking-widest"><div className="w-4 h-1.5 bg-cyan-400 rounded-sm" /> Biomass (MT)</div>
                                                </div>
                                            </div>
                                            <ResponsiveContainer width="100%" height="80%">
                                                <ComposedChart data={trendData} margin={{ bottom: 20 }}>
                                                    <XAxis dataKey="name" stroke="#e2e8f0" fontSize={10} axisLine={false} tickLine={false} label={{ value: 'SCAN NODE ID', position: 'bottom', fill: '#475569', fontSize: 10, fontWeight: 'black', offset: 0 }} />
                                                    <YAxis stroke="#e2e8f0" fontSize={10} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #1e293b', borderRadius: '16px' }} />
                                                    <Bar dataKey="cci" fill="#10b981" radius={[8, 8, 0, 0]} barSize={24} />
                                                    <Line type="monotone" dataKey="biomass" stroke="#22d3ee" strokeWidth={3} dot={{ fill: '#22d3ee', r: 4 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                            <div className="p-8 bg-white border border-slate-200 rounded-[40px] space-y-4">
                                                <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-700"><TrendingUp /></div>
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Dataset Average</h4>
                                                <p className="text-4xl font-black text-slate-900 tracking-tighter">{(trendData.reduce((acc, curr) => acc + curr.cci, 0) / trendData.length).toFixed(2)}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Active Nodes: {trendData.length}</p>
                                            </div>
                                            <div className="p-8 bg-white border border-slate-200 rounded-[40px] space-y-4">
                                                <div className="w-10 h-10 bg-cyan-500/10 rounded-2xl flex items-center justify-center text-cyan-700"><Target /></div>
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Peak Performance</h4>
                                                <p className="text-4xl font-black text-slate-900 tracking-tighter">{Math.max(...trendData.map(d => d.cci)).toFixed(2)}</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Optimized Nitrogen Sync</p>
                                            </div>
                                            <div className="p-8 bg-white border border-slate-200 rounded-[40px] space-y-4">
                                                <div className="w-10 h-10 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-700"><ShieldCheck /></div>
                                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">System Health</h4>
                                                <p className="text-4xl font-black text-slate-900 tracking-tighter">Stable</p>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Algorithm Validation v4.2</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MAPPING TAB VIEW */}
                            {activeTab === 'mapping' && (
                                <div className="space-y-12">
                                    <header className="space-y-4">
                                        <div className="inline-flex items-center gap-2 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-widest">Geospatial Intelligence</div>
                                        <h2 className="text-6xl font-black text-slate-900 tracking-tighter leading-none">Node Deployment</h2>
                                        <p className="text-slate-500 text-sm font-medium tracking-wide max-w-2xl">Geolocated measurement points visualized across the field grid for spatial analysis of chlorophyll variability.</p>
                                    </header>

                                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                                        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-[48px] p-10 h-[600px] relative overflow-hidden flex items-center justify-center">
                                            {/* Stylized Simulated Map Grid */}
                                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#10b981_1px,transparent_1px)] bg-[size:30px_30px]"></div>

                                            <div className="relative w-full h-full border border-slate-200 bg-white/80 rounded-3xl overflow-hidden shadow-inner flex items-center justify-center group">
                                                {/* Plotting simulated points on a grid */}
                                                <div className="relative w-[80%] h-[80%] border-2 border-emerald-200 rounded-xl bg-emerald-50 flex items-center justify-center">
                                                    <div className="absolute inset-0 grid grid-cols-10 grid-rows-10">
                                                        {Array.from({ length: 100 }).map((_, i) => (
                                                            <div key={i} className="border border-slate-200"></div>
                                                        ))}
                                                    </div>

                                                    {/* Plot active data points */}
                                                    {data.map((item, idx) => {
                                                        const lat = parseFloat(item.gps.split(',')[0]) || 10.8;
                                                        const lng = parseFloat(item.gps.split(',')[1]) || 76.9;
                                                        // Simple mapping logic for visualization
                                                        const top = ((lat - 10.8432) * 100000 + 50) % 90;
                                                        const left = ((lng - 76.9088) * 100000 + 50) % 90;

                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => setSelectedMeasurement(idx)}
                                                                className={`absolute w-4 h-4 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-150 z-10 ${selectedMeasurement === idx ? 'bg-emerald-500 shadow-[0_0_20px_#10b981]' : 'bg-slate-200 hover:bg-emerald-600'}`}
                                                                style={{ top: `${top}%`, left: `${left}%` }}
                                                            >
                                                                {selectedMeasurement === idx && <div className="absolute w-12 h-12 bg-emerald-500/20 rounded-full animate-ping"></div>}
                                                                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                                            </div>
                                                        );
                                                    })}

                                                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-white/60 backdrop-blur-md border border-slate-200 px-3 py-1.5 rounded-lg">
                                                        <Navigation size={12} className="text-emerald-700" />
                                                        <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Active Scanning Area</span>
                                                    </div>
                                                </div>

                                                <div className="absolute bottom-8 right-8 flex flex-col items-end gap-2 text-right">
                                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Precision Coordinate System</div>
                                                    <div className="text-sm font-black text-slate-900 font-mono tracking-tighter">WGS 84 / UTM ZONE 43N</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="lg:col-span-4 space-y-6 overflow-y-auto max-h-[600px] custom-scrollbar pr-2">
                                            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] sticky top-0 bg-slate-50 py-2 z-20">Location Registry</h3>
                                            {data.map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setSelectedMeasurement(idx)}
                                                    className={`p-6 rounded-3xl border transition-all cursor-pointer ${selectedMeasurement === idx ? 'bg-emerald-100 border-emerald-500/30' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <h4 className="text-xs font-black text-slate-900 tracking-tight">{item.id}</h4>
                                                        <span className="text-[10px] font-bold text-emerald-700">{item.cci} CCI</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-tight truncate">
                                                        <MapPin size={12} /> {item.gps}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(16,185,129,0.3); }
      `}</style>
        </div>
    );
};

export default App;
