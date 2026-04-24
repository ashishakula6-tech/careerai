import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  const token = localStorage.getItem('access_token');
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/applications/videos/all', { params: { limit: 100 } });
      setVideos(res.data.items || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fmtDuration = (s) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = Math.round(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl mb-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-rose-500" />
        <div className="absolute inset-0 bg-dots opacity-10" />
        <div className="relative p-8 text-white">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Video Pitch Gallery
          </h1>
          <p className="text-white/80 mt-2">Browse and review all candidate video pitches in one place</p>
          <p className="text-white/70 text-sm mt-1">{videos.length} videos available</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 mt-3 text-sm">Loading videos...</p>
          </div>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 font-medium">No video pitches yet</p>
          <p className="text-gray-400 text-sm mt-1">Videos will appear here as candidates apply with their video pitch</p>
        </div>
      ) : (
        /* Video grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.map((v, idx) => (
            <div key={v.application_id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden card-hover animate-slide-up cursor-pointer group"
              style={{ animationDelay: `${idx * 0.05}s` }}
              onClick={() => setSelectedVideo(v)}>
              {/* Video thumbnail (auto-loads first frame) */}
              <div className="relative aspect-video bg-black overflow-hidden">
                <video
                  className="w-full h-full object-cover"
                  src={`${apiBase}/applications/${v.application_id}/video?token=${encodeURIComponent(token || '')}`}
                  preload="metadata"
                  muted
                />
                {/* Play overlay */}
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-100 group-hover:bg-black/50 transition">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition">
                    <svg className="w-8 h-8 text-purple-600 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </div>
                {/* Duration badge */}
                {v.video_duration && (
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur text-white text-xs font-mono px-2 py-1 rounded">
                    {fmtDuration(v.video_duration)}
                  </div>
                )}
                {/* Match score badge */}
                {v.match_score != null && (
                  <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold ${
                    v.match_score >= 0.7 ? 'bg-emerald-500 text-white' :
                    v.match_score >= 0.4 ? 'bg-amber-500 text-white' :
                    'bg-rose-500 text-white'
                  }`}>
                    {(v.match_score * 100).toFixed(0)}% match
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Link to={`/candidates/${v.candidate_id}`} onClick={(e) => e.stopPropagation()}
                    className="font-bold text-gray-900 hover:text-purple-600 transition truncate">
                    {v.candidate_name}
                  </Link>
                  {v.status && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                      v.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-700' :
                      v.status === 'interview_passed' ? 'bg-green-200 text-green-800' :
                      v.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>{v.status}</span>
                  )}
                </div>
                <p className="text-sm text-gray-600 truncate">{v.job_title}</p>
                <p className="text-xs text-gray-400 truncate">{v.job_location}</p>
                <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                  <span>{fmtSize(v.video_size)}</span>
                  <span>{v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedVideo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50">
              <div>
                <Link to={`/candidates/${selectedVideo.candidate_id}`} className="font-bold text-gray-900 hover:text-purple-600 transition">
                  {selectedVideo.candidate_name}
                </Link>
                <p className="text-sm text-gray-500">{selectedVideo.job_title} — {selectedVideo.job_location}</p>
              </div>
              <button onClick={() => setSelectedVideo(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition">
                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Video */}
            <div className="bg-black">
              <video
                controls autoPlay
                className="w-full max-h-[70vh] object-contain"
                src={`${apiBase}/applications/${selectedVideo.application_id}/video?token=${encodeURIComponent(token || '')}`}
              />
            </div>
            {/* Footer */}
            <div className="p-4 flex items-center justify-between text-sm text-gray-600 bg-gray-50">
              <div className="flex gap-4">
                {selectedVideo.match_score != null && (
                  <span><strong className={`${selectedVideo.match_score >= 0.7 ? 'text-emerald-600' : selectedVideo.match_score >= 0.4 ? 'text-amber-600' : 'text-rose-500'}`}>{(selectedVideo.match_score * 100).toFixed(0)}%</strong> match</span>
                )}
                {selectedVideo.video_duration && <span>{fmtDuration(selectedVideo.video_duration)} duration</span>}
                <span>{fmtSize(selectedVideo.video_size)}</span>
              </div>
              <div className="flex gap-3">
                <Link to={`/candidates/${selectedVideo.candidate_id}`} className="text-purple-600 hover:underline font-medium">View Profile</Link>
                <a href={`${apiBase}/applications/${selectedVideo.application_id}/video?token=${encodeURIComponent(token || '')}`}
                  download={`pitch_${selectedVideo.candidate_name}.webm`}
                  className="text-indigo-600 hover:underline font-medium">Download</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
