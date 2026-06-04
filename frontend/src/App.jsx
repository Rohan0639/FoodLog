import { useState, useEffect, useRef } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000';
const CALORIES_TARGET = 2000;
const PROTEIN_TARGET = 130;
const CARBS_TARGET = 250;
const FATS_TARGET = 65;

function App() {
  const [userId] = useState(() => {
    let storedId = localStorage.getItem('foodlog_userId');
    if (!storedId) {
      storedId = 'user_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('foodlog_userId', storedId);
    }
    return storedId;
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  });
  
  const [summary, setSummary] = useState({
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFats: 0
  });
  
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      type: 'assistant',
      text: "Hi! I am your AI food logging assistant. Tell me what you ate (e.g., 'I ate 3 eggs and a bowl of rice') and I will estimate the calories/macros and log it for you.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [todayStr, setTodayStr] = useState('');
  const [yesterdayStr, setYesterdayStr] = useState('');
  
  const chatEndRef = useRef(null);

  // 1. Initialize relative display date boundaries on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    Promise.resolve().then(() => {
      setTodayStr(today);
      setYesterdayStr(yesterday);
    });
  }, []);

  const fetchDailySummary = async (uid, date) => {
    try {
      const res = await fetch(`${API_BASE}/api/summary/daily?userId=${uid}&date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch summary');
      const data = await res.json();
      setSummary({
        totalCalories: data.totalCalories || 0,
        totalProtein: data.totalProtein || 0,
        totalCarbs: data.totalCarbs || 0,
        totalFats: data.totalFats || 0
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDailyHistory = async (uid, date) => {
    try {
      const res = await fetch(`${API_BASE}/api/logs/daily?userId=${uid}&date=${date}`);
      if (!res.ok) throw new Error('Failed to fetch logs history');
      const data = await res.json();
      setHistory(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // 2. Fetch daily data when userId or selectedDate changes
  useEffect(() => {
    if (!userId) return;
    
    Promise.resolve().then(() => {
      fetchDailySummary(userId, selectedDate);
      fetchDailyHistory(userId, selectedDate);
    });
  }, [userId, selectedDate]);

  // 3. Scroll to bottom of chat whenever messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Date Navigation Helpers
  const shiftDate = (days) => {
    const currentDate = new Date(selectedDate);
    currentDate.setDate(currentDate.getDate() + days);
    
    const offset = currentDate.getTimezoneOffset();
    const localDateStr = new Date(currentDate.getTime() - (offset * 60 * 1000))
      .toISOString()
      .split('T')[0];
    
    setSelectedDate(localDateStr);
  };

  const formatDisplayDate = (dateStr) => {
    if (dateStr === todayStr) return 'TODAY';
    if (dateStr === yesterdayStr) return 'YESTERDAY';
    
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options).toUpperCase();
  };

  // Submit Text Message to Chat API
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || isLoading) return;

    // Check if there is an unresolved pending draft to prevent stacking conflicts
    const hasPending = messages.some(m => m.pendingLog && m.draftStatus === 'pending');
    if (hasPending) {
      alert('Please confirm or discard the pending food draft card before logging new items.');
      return;
    }

    // Add user message
    const userMsg = {
      id: `user_${Date.now()}`,
      type: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: text })
      });

      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();

      const assistantMsg = {
        id: `assist_${Date.now()}`,
        type: 'assistant',
        text: data.response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        pendingLog: data.pendingLog || null,
        draftStatus: data.pendingLog ? 'pending' : null
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg = {
        id: `err_${Date.now()}`,
        type: 'system',
        text: 'Error connecting to the assistant. Ensure your server is running.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateDraftItem = (msgId, itemIndex, newQtyStr) => {
    const newQty = parseFloat(newQtyStr);
    if (isNaN(newQty) || newQty < 0) return;
    
    setMessages(prev => prev.map(msg => {
      if (msg.id !== msgId || !msg.pendingLog) return msg;
      
      const updatedItems = msg.pendingLog.items.map((item, idx) => {
        if (idx !== itemIndex) return item;
        
        const oldQty = item.quantity || 1;
        const ratio = oldQty > 0 ? newQty / oldQty : 0;
        
        return {
          ...item,
          quantity: newQty,
          calories: item.calories * ratio,
          protein: item.protein * ratio,
          carbs: item.carbs * ratio,
          fats: item.fats * ratio
        };
      });

      return {
        ...msg,
        pendingLog: {
          ...msg.pendingLog,
          items: updatedItems
        }
      };
    }));
  };

  const handleDeleteDraftItem = (msgId, itemIndex) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id !== msgId || !msg.pendingLog) return msg;
      
      const filteredItems = msg.pendingLog.items.filter((_, idx) => idx !== itemIndex);
      
      return {
        ...msg,
        pendingLog: {
          ...msg.pendingLog,
          items: filteredItems
        }
      };
    }));
  };

  // Confirm Draft Food Log
  const handleConfirmLog = async (draftId, msgId) => {
    const msg = messages.find(m => m.id === msgId);
    const items = msg?.pendingLog?.items || [];
    
    if (items.length === 0) {
      alert('Your draft has no food items. Add some items or discard the draft.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/log/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          draftId,
          confirm: true,
          items: items
        })
      });

      if (!res.ok) throw new Error('Log confirmation failed');
      
      // Update local message state to show confirmed status
      setMessages(prev => 
        prev.map(m => m.id === msgId ? { ...m, draftStatus: 'confirmed' } : m)
      );

      // Add system message of success
      setMessages(prev => [...prev, {
        id: `sys_${Date.now()}`,
        type: 'system',
        text: 'Intake logged successfully!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);

      // Refresh Dashboard telemetry
      fetchDailySummary(userId, selectedDate);
      fetchDailyHistory(userId, selectedDate);
    } catch (err) {
      console.error(err);
      alert('Failed to log items.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel/Discard Draft Food Log
  const handleDiscardLog = async (draftId, msgId) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/log/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          draftId,
          confirm: false
        })
      });

      if (!res.ok) throw new Error('Discard failed');
      
      // Update message state
      setMessages(prev => 
        prev.map(m => m.id === msgId ? { ...m, draftStatus: 'discarded' } : m)
      );

      // Add system notification
      setMessages(prev => [...prev, {
        id: `sys_${Date.now()}`,
        type: 'system',
        text: 'Draft items discarded.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (err) {
      console.error(err);
      alert('Failed to cancel draft.');
    } finally {
      setIsLoading(false);
    }
  };

  // Gauge circular math
  const GAUGE_RADIUS = 68;
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
  const calPercent = Math.min((summary.totalCalories / CALORIES_TARGET) * 100, 100);
  const strokeDashoffset = GAUGE_CIRCUMFERENCE - (calPercent / 100) * GAUGE_CIRCUMFERENCE;

  // Macros progress percent
  const proteinPercent = Math.min((summary.totalProtein / PROTEIN_TARGET) * 100, 100);
  const carbsPercent = Math.min((summary.totalCarbs / CARBS_TARGET) * 100, 100);
  const fatsPercent = Math.min((summary.totalFats / FATS_TARGET) * 100, 100);

  return (
    <div className="app-container">
      {/* 1. LEFT PANEL: Interactive Dashboard */}
      <div className="dashboard-panel">
        <div className="dash-header">
          <div className="brand-title">
            BiteSize
            <div className="brand-dot"></div>
          </div>
          
          <div className="date-selector">
            <button className="date-btn" onClick={() => shiftDate(-1)} aria-label="Previous day">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <span className="date-display">{formatDisplayDate(selectedDate)}</span>
            <button className="date-btn" onClick={() => shiftDate(1)} aria-label="Next day">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Dashboard Macro Overview */}
        <div className="metrics-section">
          {/* Calorie Ring Gauge Card */}
          <div className="calorie-gauge-card">
            <span className="gauge-header">Energy Logged</span>
            <svg className="calorie-gauge-svg">
              <circle className="gauge-bg" cx="80" cy="80" r={GAUGE_RADIUS} />
              <circle 
                className="gauge-progress" 
                cx="80" 
                cy="80" 
                r={GAUGE_RADIUS} 
                strokeDasharray={GAUGE_CIRCUMFERENCE} 
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="gauge-text">
              <span className="gauge-val">{Math.round(summary.totalCalories)}</span>
              <span className="gauge-lbl">/ {CALORIES_TARGET} kcal</span>
            </div>
          </div>

          {/* Macro Progress Bars Card */}
          <div className="macros-card">
            {/* Protein */}
            <div className="macro-item protein">
              <div className="macro-meta">
                <span className="macro-name">Protein</span>
                <span className="macro-numbers">
                  <span>{Math.round(summary.totalProtein)}g</span> / {PROTEIN_TARGET}g
                </span>
              </div>
              <div className="macro-progress-bar">
                <div className="macro-progress-fill" style={{ width: `${proteinPercent}%` }} />
              </div>
            </div>

            {/* Carbs */}
            <div className="macro-item carbs">
              <div className="macro-meta">
                <span className="macro-name">Carbohydrates</span>
                <span className="macro-numbers">
                  <span>{Math.round(summary.totalCarbs)}g</span> / {CARBS_TARGET}g
                </span>
              </div>
              <div className="macro-progress-bar">
                <div className="macro-progress-fill" style={{ width: `${carbsPercent}%` }} />
              </div>
            </div>

            {/* Fats */}
            <div className="macro-item fats">
              <div className="macro-meta">
                <span className="macro-name">Fats</span>
                <span className="macro-numbers">
                  <span>{Math.round(summary.totalFats)}g</span> / {FATS_TARGET}g
                </span>
              </div>
              <div className="macro-progress-bar">
                <div className="macro-progress-fill" style={{ width: `${fatsPercent}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* History / Logged Meals List */}
        <div className="history-section">
          <h2 className="section-title">Logged Meals & Drinks</h2>
          
          {history.length === 0 ? (
            <div className="empty-history">
              <span className="empty-icon" role="img" aria-label="No entries">🍽️</span>
              <p>Nothing logged for this day yet.</p>
              <p style={{ fontSize: '13px', opacity: 0.7, marginTop: '4px' }}>
                Use the assistant console on the right to start logging your intake!
              </p>
            </div>
          ) : (
            <div className="history-list">
              {history.map((log) => {
                const totalCals = log.items.reduce((sum, item) => sum + item.calories, 0);
                const totalProt = log.items.reduce((sum, item) => sum + item.protein, 0);
                const totalCrbs = log.items.reduce((sum, item) => sum + item.carbs, 0);
                const totalFats = log.items.reduce((sum, item) => sum + item.fats, 0);
                const formattedTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={log.id} className="history-card">
                    <div className="history-card-top">
                      <span className="history-input">"{log.rawInput}"</span>
                      <span className="history-time">{formattedTime}</span>
                    </div>
                    
                    <div className="history-items-list">
                      {log.items.map((item) => (
                        <div key={item.id} className="history-item-tag">
                          {item.quantity} {item.unit || ''} {item.name} (<strong>{Math.round(item.calories)} kcal</strong>)
                        </div>
                      ))}
                    </div>

                    <div className="history-macros-summary">
                      <span>Total: <strong>{Math.round(totalCals)} kcal</strong></span>
                      <span>P: <strong>{Math.round(totalProt)}g</strong></span>
                      <span>C: <strong>{Math.round(totalCrbs)}g</strong></span>
                      <span>F: <strong>{Math.round(totalFats)}g</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. RIGHT PANEL: AI Conversation Console */}
      <div className="chat-panel">
        <div className="chat-header">
          <div className="assistant-info">
            <div className="pulse-dot"></div>
            <span className="assistant-title">Intake Logging Client</span>
          </div>
          <span className="user-badge" title="Local persistent User ID">
            ID: {userId ? userId.toUpperCase() : 'LOADING...'}
          </span>
        </div>

        <div className="messages-area">
          {messages.map((msg) => {
            const isUser = msg.type === 'user';
            const isSystem = msg.type === 'system';
            
            if (isSystem) {
              return (
                <div key={msg.id} className="system-status-msg">
                  {msg.text}
                </div>
              );
            }

            return (
              <div key={msg.id} className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
                <div className="message-content">
                  {msg.text}

                  {/* Pending Draft Confirmation Panel nested in chat bubble */}
                  {msg.pendingLog && msg.draftStatus === 'pending' && (
                    <div className="pending-draft-card">
                      <div className="draft-header">Review Estimates</div>
                      <table className="draft-items-table">
                        <thead>
                          <tr>
                            <th>Food Item</th>
                            <th style={{ width: '80px' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Nutrition Info</th>
                            <th style={{ width: '36px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {msg.pendingLog.items.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '500' }}>{item.name}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input 
                                    type="number" 
                                    step="any"
                                    min="0"
                                    value={item.quantity} 
                                    onChange={(e) => handleUpdateDraftItem(msg.id, idx, e.target.value)}
                                    style={{
                                      width: '56px',
                                      padding: '3px 6px',
                                      border: '1.5px solid var(--border)',
                                      borderRadius: '3px',
                                      fontFamily: 'var(--mono)',
                                      fontSize: '13px',
                                      background: 'var(--bg)',
                                      color: 'var(--text-h)'
                                    }}
                                  />
                                  <span style={{ fontSize: '12px', color: 'var(--text)' }}>{item.unit || ''}</span>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <strong>{Math.round(item.calories)} kcal</strong>
                                <div className="draft-item-macros" style={{ fontSize: '11px', color: 'var(--text)', opacity: 0.8 }}>
                                  P:{Math.round(item.protein)}g | C:{Math.round(item.carbs)}g | F:{Math.round(item.fats)}g
                                </div>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button 
                                  onClick={() => handleDeleteDraftItem(msg.id, idx)}
                                  title="Delete item"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '2px',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text)'}
                                >
                                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="draft-actions">
                        <button 
                          className="btn btn-confirm" 
                          onClick={() => handleConfirmLog(msg.pendingLog.draftId, msg.id)}
                          disabled={isLoading}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          Confirm & Log
                        </button>
                        <button 
                          className="btn btn-cancel" 
                          onClick={() => handleDiscardLog(msg.pendingLog.draftId, msg.id)}
                          disabled={isLoading}
                        >
                          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Discard
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Static text status when log was already confirmed/discarded */}
                  {msg.draftStatus === 'confirmed' && (
                    <div style={{ color: 'var(--success)', fontSize: '12px', fontWeight: '700', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Logged into Daily Summary
                    </div>
                  )}
                  {msg.draftStatus === 'discarded' && (
                    <div style={{ color: 'var(--text)', opacity: 0.6, fontSize: '12px', fontWeight: '700', marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Draft intake discarded
                    </div>
                  )}
                </div>
                <span className="message-time">{msg.timestamp}</span>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isLoading && (
            <div className="message-bubble assistant">
              <div className="message-content" style={{ padding: '10px 14px' }}>
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="chat-footer">
          <form onSubmit={handleSendMessage} className="input-container">
            <input 
              type="text" 
              className="chat-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="What did you eat or drink?"
              disabled={isLoading}
            />
            <button type="submit" className="send-btn" disabled={!inputText.trim() || isLoading}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default App
