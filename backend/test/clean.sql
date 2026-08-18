TRUNCATE TABLE "Message", "Notification", "PostShare", "SavedPost", "StoryView", "Story" CASCADE;
TRUNCATE TABLE "CommentReaction", "Reaction", "Comment", "PostMedia", "Post" CASCADE;
TRUNCATE TABLE "Follow", "Friendship", "FriendRequest" CASCADE;
TRUNCATE TABLE "ConversationParticipant", "MessageRead", "Conversation" CASCADE;
TRUNCATE TABLE "EventMember", "Event", "GroupPost", "GroupMember", "Group" CASCADE;
TRUNCATE TABLE "MarketplaceListing", "Block", "Report", "NotificationSetting", "Profile", "User" CASCADE;