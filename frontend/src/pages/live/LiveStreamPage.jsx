import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { liveService } from '../../services';
import UserAvatar from '../../components/common/UserAvatar';
import Icon from '../../components/common/Icon';
import useIsMobile from '../../hooks/useIsMobile';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

export default function LiveStreamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const isMobile = useIsMobile();

  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [isJoined, setIsJoined] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewerList, setViewerList] = useState([]);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(!isMobile);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const commentsEndRef = useRef(null);
  const reactionIdRef = useRef(0);

  const isBroadcaster = live?.ownerId === user?.id;
  const isLive = live?.status === 'LIVE';

  useEffect(() => {
    loadLive();
    return () => {
      cleanup();
    };
  }, [id]);

  useEffect(() => {
    if (!socket || !live) return;

    socket.emit('live:join', { liveId: live.id });

    socket.on('live:viewer-count', ({ count }) => setViewerCount(count));
    socket.on('live:new-comment', ({ comment }) => {
      setComments((prev) => [...prev.slice(-199), comment]);
    });
    socket.on('live:new-reaction', ({ userId: uid, emoji }) => {
      addFloatingReaction(emoji);
    });
    socket.on('live:ended', () => {
      setLive((prev) => prev ? { ...prev, status: 'ENDED' } : prev);
    });
    socket.on('live:error', ({ error: msg }) => {
      console.error('Live error:', msg);
    });
    socket.on('live:signal', handleSignal);

    return () => {
      socket.emit('live:leave', { liveId: live.id });
      socket.off('live:viewer-count');
      socket.off('live:new-comment');
      socket.off('live:new-reaction');
      socket.off('live:ended');
      socket.off('live:error');
      socket.off('live:signal');
    };
  }, [socket, live]);

  useEffect(() => {
    if (commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const loadLive = async () => {
    try {
      setLoading(true);
      const result = id
        ? await liveService.get(id)
        : await liveService.myActive();
      setLive(result.live);
      setViewerCount(result.live?.currentViewerCount || 0);
      setError(null);
    } catch (err) {
      setError('Failed to load live stream');
    } finally {
      setLoading(false);
    }
  };

  const cleanup = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  const startBroadcasting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      await liveService.start(live.id);
      setLive((prev) => ({ ...prev, status: 'LIVE', startedAt: new Date().toISOString() }));
    } catch (err) {
      setError('Failed to access camera/microphone');
    }
  };

  const stopBroadcasting = async () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (socket) {
      socket.emit('live:broadcast-end', { liveId: live.id });
    }
    await liveService.end(live.id);
    setLive((prev) => ({ ...prev, status: 'ENDED' }));
  };

  const setupPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('live:signal', {
          liveId: live.id,
          targetUserId,
          type: 'ice-candidate',
          payload: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [socket, live]);

  const handleSignal = useCallback(async ({ fromUserId, type, payload }) => {
    if (!isBroadcaster && type === 'offer') {
      const pc = setupPeerConnection(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('live:signal', {
        liveId: live.id,
        targetUserId: fromUserId,
        type: 'answer',
        payload: answer,
      });
    } else if (isBroadcaster && type === 'answer') {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(payload));
      }
    } else if (type === 'ice-candidate') {
      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(payload));
        } catch (e) {
          // ignore
        }
      }
    }
  }, [isBroadcaster, socket, live, setupPeerConnection]);

  const sendComment = (e) => {
    e.preventDefault();
    if (!commentText.trim() || !socket || !live) return;
    socket.emit('live:comment', { liveId: live.id, content: commentText.trim() });
    setCommentText('');
  };

  const sendReaction = (emoji) => {
    if (!socket || !live) return;
    socket.emit('live:reaction', { liveId: live.id, emoji });
    addFloatingReaction(emoji);
  };

  const addFloatingReaction = (emoji) => {
    const id = ++reactionIdRef.current;
    setFloatingReactions((prev) => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3000);
  };

  const handleEndLive = async () => {
    if (!window.confirm('End this live stream?')) return;
    await stopBroadcasting();
  };

  const handleReport = async () => {
    const reason = window.prompt('Why are you reporting this live stream?');
    if (!reason?.trim()) return;
    try {
      await liveService.report(live.id, reason);
      alert('Report submitted');
    } catch (err) {
      alert('Failed to submit report');
    }
  };

  const handleBanUser = async (targetUserId) => {
    if (!window.confirm('Ban this user from the live stream?')) return;
    try {
      await liveService.ban(live.id, targetUserId);
      alert('User banned');
    } catch (err) {
      alert('Failed to ban user');
    }
  };

  const loadViewers = async () => {
    try {
      const result = await liveService.viewers(live.id);
      setViewerList(result.viewers || []);
    } catch (err) {
      // silent
    }
  };

  const toggleViewers = () => {
    if (!showViewers) loadViewers();
    setShowViewers(!showViewers);
  };

  if (loading) {
    return (
      <div className="live-page">
        <div className="live-loading">
          <div className="live-spinner" />
          <p>Loading live stream...</p>
        </div>
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="live-page">
        <div className="live-error">
          <Icon name="video" size={48} />
          <p>{error || 'Live stream not found'}</p>
          <button className="live-btn live-btn-primary" onClick={() => navigate('/')}>
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`live-page ${isMobile ? 'live-page-mobile' : ''}`}>
      <div className="live-main">
        <div className="live-video-area">
          <div className="live-video-container">
            {isBroadcaster && isLive ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="live-video live-video-local"
              />
            ) : isLive ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="live-video live-video-remote"
              />
            ) : (
              <div className="live-placeholder">
                <Icon name="video" size={64} />
                <p>{isBroadcaster ? 'Click "Go Live" to start' : 'Stream has not started yet'}</p>
              </div>
            )}

            <div className="live-overlay-top">
              <div className="live-badge-row">
                {isLive && <span className="live-badge">LIVE</span>}
                <span className="live-viewer-count">
                  <Icon name="users" size={14} />
                  {viewerCount}
                </span>
              </div>
              {isBroadcaster && (
                <div className="live-controls-top">
                  <button
                    className="live-icon-btn"
                    onClick={() => setIsMuted(!isMuted)}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    <Icon name={isMuted ? 'mic_off' : 'mic'} size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="live-overlay-bottom">
              <div className="live-stream-info">
                <UserAvatar user={live.owner} size={36} />
                <div>
                  <span className="live-streamer-name">{live.owner.fullName || live.owner.username}</span>
                  <span className="live-stream-title">{live.title || 'Untitled Live'}</span>
                </div>
              </div>
            </div>

            <div className="live-floating-reactions">
              {floatingReactions.map((r) => (
                <span key={r.id} className="live-float-emoji" style={{ left: `${r.x}%` }}>
                  {r.emoji}
                </span>
              ))}
            </div>

            {isBroadcaster && (
              <div className="live-broadcast-controls">
                {!isLive ? (
                  <button className="live-btn live-btn-go-live" onClick={startBroadcasting}>
                    <Icon name="video" size={18} />
                    Go Live
                  </button>
                ) : (
                  <button className="live-btn live-btn-end" onClick={handleEndLive}>
                    <Icon name="end_call" size={18} />
                    End Live
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="live-reactions-bar">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="live-reaction-btn"
                onClick={() => sendReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className={`live-sidebar ${showComments ? 'live-sidebar-open' : ''}`}>
          <div className="live-sidebar-header">
            <h3>Comments</h3>
            <div className="live-sidebar-actions">
              <button className="live-icon-btn" onClick={toggleViewers} title="Viewers">
                <Icon name="users" size={16} />
                <span>{viewerCount}</span>
              </button>
              {!isBroadcaster && (
                <button className="live-icon-btn" onClick={handleReport} title="Report">
                  <Icon name="shield" size={16} />
                </button>
              )}
              {isMobile && (
                <button className="live-icon-btn" onClick={() => setShowComments(false)} title="Close">
                  <Icon name="more" size={16} />
                </button>
              )}
            </div>
          </div>

          {showViewers && (
            <div className="live-viewer-list">
              {viewerList.map((v) => (
                <div key={v.userId} className="live-viewer-item">
                  <UserAvatar user={v.user} size={28} />
                  <span>{v.user.fullName || v.user.username}</span>
                  {isBroadcaster && v.userId !== user.id && (
                    <button
                      className="live-icon-btn live-icon-btn-sm"
                      onClick={() => handleBanUser(v.userId)}
                      title="Ban user"
                    >
                      <Icon name="more" size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="live-comments-list">
            {comments.map((c) => (
              <div key={c.id} className="live-comment">
                <UserAvatar user={c.user} size={28} />
                <div className="live-comment-body">
                  <span className="live-comment-name">{c.user.fullName || c.user.username}</span>
                  <span className="live-comment-text">{c.content}</span>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          <form className="live-comment-form" onSubmit={sendComment}>
            <input
              type="text"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={500}
            />
            <button type="submit" disabled={!commentText.trim()} className="live-icon-btn">
              <Icon name="send" size={18} />
            </button>
          </form>
        </div>
      </div>

      {isMobile && !showComments && (
        <button className="live-mobile-comments-toggle" onClick={() => setShowComments(true)}>
          <Icon name="comment" size={20} />
          <span>{comments.length}</span>
        </button>
      )}
    </div>
  );
}
