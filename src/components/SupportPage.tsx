import React, { useState, useEffect } from 'react';
import { ArrowLeft, Send, MessageSquare, Clock, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import { API_BASE } from '../config';
import { SupportTicket } from '../types';

interface SupportPageProps {
  userId: string;
  userName: string;
  userEmail: string;
  canteenId?: string;
  collegeId?: string;
  onBack: () => void;
}

const CATEGORIES = [
  { value: 'payment', label: 'Payment Issue', icon: '💳', desc: 'Payment failed, stuck, or not reflecting' },
  { value: 'refund', label: 'Refund Request', icon: '💰', desc: 'Refund not received or delayed' },
  { value: 'order', label: 'Order Problem', icon: '📦', desc: 'Wrong item, missing item, quality issue' },
  { value: 'account', label: 'Account Issue', icon: '👤', desc: 'Login problem, profile update, deletion' },
  { value: 'app', label: 'App / Technical', icon: '📱', desc: 'App crash, bug, slow loading' },
  { value: 'other', label: 'Other', icon: '❓', desc: 'General inquiry or feedback' },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Open' },
  in_progress: { color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: 'In Progress' },
  resolved: { color: 'text-green-700', bg: 'bg-green-50 border-green-200', label: 'Resolved' },
  closed: { color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', label: 'Closed' },
};

export default function SupportPage({ userId, userName, userEmail, canteenId, collegeId, onBack }: SupportPageProps) {
  const [category, setCategory] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<SupportTicket | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [view, setView] = useState<'form' | 'history'>('form');

  useEffect(() => {
    fetchMyTickets();
  }, []);

  const fetchMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const resp = await fetch(`${API_BASE}/api/support/user?userId=${userId}`);
      const data = await resp.json();
      if (data.success) setMyTickets(data.tickets || []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    }
    setLoadingTickets(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !subject.trim() || !description.trim()) return;

    setIsSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/support/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          userName,
          userEmail,
          category,
          subject: subject.trim(),
          description: description.trim(),
          orderId: orderId.trim() || undefined,
          canteenId,
          collegeId,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setSubmittedTicket(data.ticket);
        setSubmitted(true);
        fetchMyTickets();
      } else {
        alert(data.error || 'Failed to submit ticket');
      }
    } catch (err) {
      alert('Network error. Please try again.');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setCategory('');
    setSubject('');
    setDescription('');
    setOrderId('');
    setSubmitted(false);
    setSubmittedTicket(null);
  };

  return (
    <div className="min-h-screen bg-[#fbfcff]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-gray-900 text-lg">Help & Support</h1>
            <p className="text-xs text-gray-500">We're here to help you</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Tab Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('form')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              view === 'form'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <HelpCircle className="h-4 w-4 inline mr-1" />
            Submit Request
          </button>
          <button
            onClick={() => { setView('history'); fetchMyTickets(); }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              view === 'history'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-1" />
            My Requests {myTickets.length > 0 && `(${myTickets.length})`}
          </button>
        </div>

        {/* ─── FORM VIEW ─── */}
        {view === 'form' && (
          <>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-lg font-bold text-green-800 mb-2">Ticket Submitted!</h2>
                <p className="text-sm text-green-700 mb-1">Ticket ID: <span className="font-mono font-bold">{submittedTicket?.id}</span></p>
                <p className="text-sm text-green-600 mb-4">We've sent an email notification. Our team will respond shortly.</p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={resetForm}
                    className="px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700"
                  >
                    Submit Another
                  </button>
                  <button
                    onClick={() => setView('history')}
                    className="px-5 py-2 bg-white text-green-700 border border-green-300 rounded-xl text-sm font-semibold hover:bg-green-50"
                  >
                    View My Requests
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Category Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">What do you need help with?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          category === cat.value
                            ? 'border-amber-500 bg-amber-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <span className="text-xl">{cat.icon}</span>
                        <p className={`text-xs font-semibold mt-1 ${category === cat.value ? 'text-amber-700' : 'text-gray-700'}`}>{cat.label}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{cat.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief summary of your issue"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    required
                    maxLength={100}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Please describe your issue in detail. Include any error messages, order IDs, or screenshots if possible."
                    rows={5}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                    required
                    maxLength={2000}
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/2000</p>
                </div>

                {/* Order ID (optional) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Related Order ID <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="e.g. ORD_1234"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    maxLength={50}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={!category || !subject.trim() || !description.trim() || isSubmitting}
                  className="w-full py-3 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isSubmitting ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            )}
          </>
        )}

        {/* ─── HISTORY VIEW ─── */}
        {view === 'history' && (
          <div className="space-y-3">
            {loadingTickets ? (
              <div className="text-center py-12 text-gray-400">
                <div className="h-8 w-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                Loading your requests...
              </div>
            ) : myTickets.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No support requests yet</p>
                <button onClick={() => setView('form')} className="mt-3 text-amber-600 text-sm font-semibold hover:underline">
                  Submit your first request
                </button>
              </div>
            ) : (
              myTickets.map((ticket) => {
                const st = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
                const cat = CATEGORIES.find(c => c.value === ticket.category);
                return (
                  <div key={ticket.id} className={`rounded-2xl border p-4 ${st.bg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base">{cat?.icon || '❓'}</span>
                          <span className={`text-xs font-bold ${st.color}`}>{st.label}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{ticket.id}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-gray-800 truncate">{ticket.subject}</h3>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{ticket.description}</p>
                        {ticket.adminReply && (
                          <div className="mt-2 bg-white rounded-lg p-2.5 border border-gray-200">
                            <p className="text-[10px] font-bold text-purple-600 mb-0.5">Admin Reply:</p>
                            <p className="text-xs text-gray-700">{ticket.adminReply}</p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                        {ticket.orderId && (
                          <p className="text-[10px] text-gray-400 mt-0.5 font-mono">{ticket.orderId}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
