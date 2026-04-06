import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, ChevronRight, BookOpen, User, Layout, Clock, Sparkles, Loader2, RotateCcw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// 初始化 Gemini AI (API Key 由環境自動注入)
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

/**
 * 復盤方法配置
 */
const METHODS_CONFIG = {
  '早晨反思': {
    subtitle: '晨間覺察',
    fields: [
      { id: 'morning_think', label: '我在想什麼？', placeholder: '捕捉當下腦中的念頭...' },
      { id: 'morning_feel', label: '我感覺如何？', placeholder: '描述目前的情緒狀態...' },
      { id: 'morning_excited', label: '什麼事讓我興奮？', placeholder: '今天最期待的事情是？' }
    ]
  },
  '行事曆挖礦': {
    subtitle: '昨日回顧',
    fields: [
      { id: 'cal_review', label: '回顧昨日行程', placeholder: '昨天從早到晚做了哪些事？' },
      { id: 'cal_event', label: '挑出有感事件', placeholder: '哪一件事讓你印象最深刻？' },
      { id: 'cal_reflect', label: '反思 (情緒/原因/行動)', placeholder: '為什麼有感？當時情緒？下次如何優化？' }
    ]
  },
  'ORID': {
    subtitle: '生活有感事件',
    fields: [
      { id: 'orid_o', label: '客觀 (Objective)', placeholder: '發生了什麼事實？看到了什麼？' },
      { id: 'orid_r', label: '反應 (Reflective)', placeholder: '你的心情或直覺反應是什麼？' },
      { id: 'orid_i', label: '詮釋 (Interpretive)', placeholder: '這件事對你的意義？學到了什麼？' },
      { id: 'orid_d', label: '決定 (Decisional)', placeholder: '下一步具體要做什麼？' }
    ]
  },
  'PAR': {
    subtitle: '專案/任務執行',
    fields: [
      { id: 'par_p', label: '目的 (Purpose)', placeholder: '你原本想達成什麼目標？' },
      { id: 'par_a', label: '行動 (Action)', placeholder: '你具體採取了哪些步驟？' },
      { id: 'par_r', label: '結果 (Result)', placeholder: '最終的產出或影響是什麼？' }
    ]
  },
  'AAR': {
    subtitle: '今日收穫總結',
    fields: [
      { id: 'aar_done', label: '今天完成什麼？', placeholder: '列出今日的主要產出...' },
      { id: 'aar_feel', label: '有啟發/有感覺的事情？', placeholder: '意外的收穫或觸動...' },
      { id: 'aar_learn', label: '學到什麼？', placeholder: '總結一條可以帶走的經驗...' }
    ]
  },
  '2分鐘列點': {
    subtitle: '快速記錄',
    fields: [
      { id: 'bullet_do', label: '今天做了什麼？', placeholder: '快速列點描述...' },
      { id: 'bullet_lesson', label: '反思與教訓', placeholder: '今天最重要的一個體悟...' }
    ]
  }
};

const ROLES = ['工程師', '產品經理', '創業者', '學習者', '爸爸/媽媽', '未指定'];
const SCENARIOS = ['生活習慣', '學習知識', '工作經驗', '人際溝通'];

export default function App() {
  // 狀態管理
  const [role, setRole] = useState('未指定');
  const [scenario, setScenario] = useState('生活習慣');
  const [method, setMethod] = useState('PAR');
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  
  // AI 相關狀態
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 初始化時讀取 LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('review_navigator_v1');
    if (saved) {
      const parsed = JSON.parse(saved);
      setRole(parsed.role || '未指定');
      setScenario(parsed.scenario || '生活習慣');
      setMethod(parsed.method || 'PAR');
      setInputs(parsed.inputs || {});
    }
  }, []);

  // 當狀態改變時儲存到 LocalStorage
  useEffect(() => {
    const stateToSave = { role, scenario, method, inputs };
    localStorage.setItem('review_navigator_v1', JSON.stringify(stateToSave));
  }, [role, scenario, method, inputs]);

  // 處理輸入變更
  const handleInputChange = (id: string, value: string) => {
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  // AI 智慧修飾功能
  const handleAiPolish = async () => {
    if (Object.values(inputs).filter(v => v.trim()).length === 0) {
      alert("請先輸入一些內容再讓 AI 幫你修飾喔！");
      return;
    }

    setIsAiLoading(true);
    setAiResult(null);

    try {
      const config = METHODS_CONFIG[method as keyof typeof METHODS_CONFIG];
      let contentString = "";
      config.fields.forEach(f => {
        contentString += `${f.label}: ${inputs[f.id] || "未填寫"}\n`;
      });

      const prompt = `
        你是一位專業的個人成長教練與寫作導航員。
        使用者正在使用「${method}」復盤法進行記錄。
        
        使用者背景：
        - 角色：${role}
        - 場景：${scenario}
        
        原始內容：
        ${contentString}
        
        請執行以下任務：
        1. 修飾文字：保持原始結構，但讓文字更通順、專業且具備反思深度。
        2. 提煉洞察：從內容中找出一個核心體悟。
        3. 行動建議：根據內容提供 1-2 個具體、可執行的下一步建議。
        
        請用繁體中文回答，並使用 Markdown 格式，讓排版美觀。
      `;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiResult(response.text || "AI 無法生成內容，請稍後再試。");
    } catch (error) {
      console.error("AI Error:", error);
      setAiResult("呼叫 AI 時發生錯誤，請檢查網路或 API 設定。");
    } finally {
      setIsAiLoading(false);
    }
  };

  // 複製功能
  const handleCopy = (textToCopy?: string) => {
    let text = "";
    if (textToCopy) {
      text = textToCopy;
    } else {
      const config = METHODS_CONFIG[method as keyof typeof METHODS_CONFIG];
      const date = new Date().toLocaleDateString('zh-TW');
      text = `【${method} 復盤卡片】\n日期：${date}\n角色：${role}\n場景：${scenario}\n------------------\n`;
      config.fields.forEach(field => {
        text += `\n[${field.label}]\n${inputs[field.id] || '(未填寫)'}\n`;
      });
    }

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentFields = useMemo(() => METHODS_CONFIG[method as keyof typeof METHODS_CONFIG].fields, [method]);

  return (
    <div className="flex h-screen bg-white text-[#37352f] overflow-hidden font-sans">
      
      {/* 左側：配置與輸入區 */}
      <div className="w-1/2 h-full border-r border-gray-200 overflow-y-auto p-8 lg:p-12">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <BookOpen size={24} />
            <span className="font-bold tracking-tight">REVIEW NAVIGATOR</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">復盤寫作導航員</h1>
          <p className="text-gray-500">將日常經驗轉化為結構化的智慧。</p>
        </header>

        {/* 第一步：設定脈絡 */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">1</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">設定脈絡</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-600">
                <User size={14} /> 人生角色
              </label>
              <select 
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-2.5 border border-gray-200 rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium mb-2 text-gray-600">
                <Layout size={14} /> 應用場景
              </label>
              <div className="flex flex-wrap gap-2">
                {SCENARIOS.map(s => (
                  <button
                    key={s}
                    onClick={() => setScenario(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      scenario === s 
                        ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm' 
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 第二步：選擇復盤方法 */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">2</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">選擇復盤方法</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.keys(METHODS_CONFIG).map(m => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={`p-3 text-left rounded-xl border transition-all ${
                  method === m 
                    ? 'bg-gray-50 border-gray-300 shadow-inner font-semibold text-gray-900' 
                    : 'bg-white border-gray-100 text-gray-500 hover:bg-gray-50 hover:border-gray-200'
                }`}
              >
                <div className="text-[10px] opacity-50 mb-1 uppercase font-bold tracking-wider">
                  {METHODS_CONFIG[m as keyof typeof METHODS_CONFIG].subtitle}
                </div>
                <div className="text-sm">{m}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 第三步：引導提問表單 */}
        <section className="mb-20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">3</div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">引導提問</h2>
          </div>
          <div className="space-y-6">
            {currentFields.map(field => (
              <div key={field.id} className="group">
                <label className="block text-sm font-bold mb-2 text-gray-700 group-focus-within:text-blue-600 transition-colors">
                  {field.label}
                </label>
                <textarea 
                  value={inputs[field.id] || ''}
                  onChange={(e) => handleInputChange(field.id, e.target.value)}
                  className="w-full p-4 border border-gray-200 rounded-xl bg-white shadow-sm min-h-[120px] text-sm focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all resize-none"
                  placeholder={field.placeholder}
                />
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 右側：預覽與結果區 */}
      <div className="w-1/2 h-full bg-[#fbfbfa] overflow-y-auto p-8 lg:p-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-2 text-gray-400">
              <Clock size={16} />
              <span className="text-xs font-medium uppercase tracking-widest">Live Preview</span>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAiPolish}
                disabled={isAiLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg ${
                  isAiLoading 
                    ? 'bg-blue-100 text-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                }`}
              >
                {isAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {isAiLoading ? 'AI 正在思考...' : 'AI 智慧修飾'}
              </button>
              <button 
                onClick={() => handleCopy()}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-lg ${
                  copied 
                    ? 'bg-green-500 text-white scale-95' 
                    : 'bg-black text-white hover:bg-gray-800 active:scale-95'
                }`}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? '已複製' : '複製全文'}
              </button>
            </div>
          </div>

          {/* AI 結果顯示區 (如果有的話) */}
          {aiResult && (
            <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-8 relative">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Sparkles size={18} />
                    <span className="text-sm font-bold uppercase tracking-wider">AI 修飾結果</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleCopy(aiResult)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="複製 AI 結果"
                    >
                      <Copy size={16} />
                    </button>
                    <button 
                      onClick={() => setAiResult(null)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                      title="清除"
                    >
                      <RotateCcw size={16} />
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                  <div className="whitespace-pre-wrap">{aiResult}</div>
                </div>
              </div>
            </div>
          )}

          {/* 預覽卡片 */}
          <div className={`bg-white p-10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 min-h-[500px] transition-opacity ${aiResult ? 'opacity-50' : 'opacity-100'}`}>
            <div className="mb-8 pb-8 border-b border-gray-100">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider mb-4">
                {method} 復盤模式
              </div>
              <h3 className="text-3xl font-bold mb-6 text-gray-900">
                {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })} 經驗記錄
              </h3>
              <div className="flex gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Role</span>
                  <span className="font-semibold text-gray-700">{role}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Scenario</span>
                  <span className="font-semibold text-gray-700">{scenario}</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {currentFields.map(field => (
                <div key={field.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <ChevronRight size={14} className="text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{field.label}</h4>
                  </div>
                  <div className="pl-5">
                    {inputs[field.id] ? (
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap text-[15px]">
                        {inputs[field.id]}
                      </p>
                    ) : (
                      <p className="text-gray-300 italic text-sm">尚未輸入內容...</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
              Auto-saved to local storage
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
