import { useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { messageService } from '../../services';
import { useSocket } from '../../context/SocketContext.jsx';
import ConversationList from '../messenger/ConversationList.jsx';

// Messenger dropdown for the navbar. Uses the existing ConversationList for
// the rows (so behavior matches the in-app messenger), wrapped in the helper's
// 360px panel shape.
export default memo(function MessengerDropdown({ onClose }) {
  const { onlineUsers } = useSocket();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);

  const load = useCallback(async () => {
    try {
      const data = await messageService.conversations();
      if (data?.success === false) return;
      setConversations(data.conversations || []);
    } catch (err) {
      // handled globally
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('socket:new-message', handler);
    return () => window.removeEventListener('socket:new-message', handler);
  }, [load]);

  return (
    <div className="dropdown-menu messenger-dropdown anim-pop-in" role="menu" aria-label="Messenger">
      <div className="messenger-dropdown-header">
        <h4 className="messenger-dropdown-title">Chats</h4>
        <button
          type="button"
          className="messenger-dropdown-link"
          onClick={() => { onClose?.(); navigate('/messages'); }}
        >
          See all in Messenger
        </button>
      </div>
      <div className="messenger-dropdown-list">
        {conversations.length === 0 && (
          <div className="messenger-dropdown-empty">No active chats</div>
        )}
        <ConversationList
          conversations={conversations}
          onlineUsers={onlineUsers}
          autoSelect={false}
          onSelect={(c) => { onClose?.(); navigate(`/messages/${c.id}`); }}
        />
      </div>
    </div>
  );
});
